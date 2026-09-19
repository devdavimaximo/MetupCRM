using Metup.Application.Deals.Commands.CloseDeal;
using Metup.Application.Deals.Commands.UpdateDeal;
using Metup.Application.Deals.Common;
using Metup.Application.Deals.Queries.GetPipelineEvolution;
using Metup.Application.Integrations.Commands.ReceiveMetaAdsLead;
using Metup.Application.Tests.Dashboard;
using Metup.Domain.Deals;
using Metup.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Metup.Application.Tests.Deals;

public class DealValueHistoryTests
{
    private static readonly DateTime Now = PipelineTestContext.NowUtc;

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Atualizar_grava_historico_so_quando_o_valor_muda()
    {
        using var context = new PipelineTestContext();
        var deal = context.AddDeal(context.AdminUserId, Now.AddDays(-10), amount: 1_000m, ticket: 800m);
        var handler = new UpdateDealCommandHandler(context.Db, context.As(context.CloserUserId, UserRole.Closer), context.Clock);

        // Mesmo valor, outros campos mudando: nada a registrar.
        await handler.Handle(new UpdateDealCommand(deal.Id, null, DealSource.WhatsApp, context.SdrUserId, 800m, 1_000m), Ct);
        Assert.Empty(context.Db.DealValueChanges);

        await handler.Handle(new UpdateDealCommand(deal.Id, null, DealSource.WhatsApp, context.SdrUserId, 900m, 1_500m), Ct);

        var change = Assert.Single(context.Db.DealValueChanges);
        Assert.Equal(
            (context.OrganizationId, deal.Id, 1_000m, 1_500m, 800m, 900m, context.CloserUserId, Now),
            (change.OrganizationId, change.DealId, change.FromAmount, change.ToAmount, change.FromTicket, change.ToTicket, change.ChangedByUserId, change.ChangedAt));

        // Limpar o valor também é mudança.
        await handler.Handle(new UpdateDealCommand(deal.Id, null, DealSource.WhatsApp, context.SdrUserId, 900m, null), Ct);
        Assert.Equal(2, context.Db.DealValueChanges.Count());
    }

    [Fact]
    public async Task Fechar_grava_historico_so_se_o_valor_fechado_mudar_o_valor()
    {
        using var context = new PipelineTestContext();
        var sameValue = context.AddDeal(context.AdminUserId, Now.AddDays(-10), amount: 2_000m);
        var newValue = context.AddDeal(context.AdminUserId, Now.AddDays(-10), ticket: 3_000m);
        var handler = new CloseDealCommandHandler(
            context.Db, context.As(context.AdminUserId, UserRole.Admin), context.Clock, new RecordingPublisher());

        await handler.Handle(new CloseDealCommand(sameValue.Id, true, 2_000m), Ct);
        await handler.Handle(new CloseDealCommand(newValue.Id, true, 3_200m), Ct);

        var change = Assert.Single(context.Db.DealValueChanges);
        Assert.Equal((newValue.Id, null, 3_200m, 3_000m, 3_000m), (change.DealId, change.FromAmount, change.ToAmount, change.FromTicket, change.ToTicket));
        Assert.Equal(1, await context.Db.StageChanges.CountAsync(sc => sc.DealId == newValue.Id && sc.ToStage == DealStage.Ganho, Ct));
    }

    [Fact]
    public async Task Valor_vigente_no_instante_segue_o_historico()
    {
        using var context = new PipelineTestContext();
        var changed = context.AddDeal(context.AdminUserId, Now.AddDays(-60), ticket: 1_000m);
        context.ChangeValue(changed, 2_000m, 1_000m, Now.AddDays(-40));
        context.ChangeValue(changed, 2_500m, null, Now.AddDays(-20));
        var untouched = context.AddDeal(context.AdminUserId, Now.AddDays(-60), amount: 700m);

        async Task<(decimal? Amount, decimal? Ticket)> At(Deal deal, DateTime instant)
        {
            var row = await context.Db.Deals.Where(d => d.Id == deal.Id).AtInstant(context.Db, instant).SingleAsync(Ct);
            return (row.Amount, row.Ticket);
        }

        // Antes da primeira mudança: o "de" dela. Entre mudanças: o "para" da anterior. Depois: o "para" da última.
        Assert.Equal((null, 1_000m), await At(changed, Now.AddDays(-50)));
        Assert.Equal((2_000m, 1_000m), await At(changed, Now.AddDays(-40)));
        Assert.Equal((2_000m, 1_000m), await At(changed, Now.AddDays(-30)));
        Assert.Equal((2_500m, null), await At(changed, Now));
        // Sem histórico: o valor atual, em qualquer instante.
        Assert.Equal((700m, null), await At(untouched, Now.AddDays(-59)));

        var before = await context.Db.Deals.Where(d => d.Id == changed.Id).AtInstant(context.Db, Now.AddDays(-61)).SingleAsync(Ct);
        Assert.False(before.IsOpen);
    }

    [Fact]
    public async Task Evolucao_le_o_pipeline_no_fim_de_cada_mes_local()
    {
        using var context = new PipelineTestContext();
        // Criado em 10/04, ticket 1.000; em 15/06 vira 3.000 de valor; ganho em 20/08.
        var deal = context.AddDeal(context.AdminUserId, new DateTime(2026, 4, 10, 15, 0, 0, DateTimeKind.Utc), ticket: 1_000m);
        context.ChangeValue(deal, 3_000m, 1_000m, new DateTime(2026, 6, 15, 15, 0, 0, DateTimeKind.Utc));
        context.Close(deal, won: true, new DateTime(2026, 8, 20, 15, 0, 0, DateTimeKind.Utc));
        // Criado às 22h de 31/07 em São Paulo (01/08 UTC): conta no fim de julho local.
        context.AddDeal(context.AdminUserId, new DateTime(2026, 8, 1, 1, 0, 0, DateTimeKind.Utc), amount: 500m);

        var evolution = await context.Evolution(context.AdminUserId, UserRole.Admin)
            .Handle(new GetPipelineEvolutionQuery(new DealPipelineFilter(AllOwners: true), 6), Ct);

        Assert.Equal(
            ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"],
            evolution.Points.Select(p => p.Month));
        Assert.Equal([1_000m, 1_000m, 3_000m, 3_500m, 500m, 500m], evolution.Points.Select(p => p.PipelineTotal));
        Assert.Equal([1, 1, 1, 2, 1, 1], evolution.Points.Select(p => p.OpenDeals));
        Assert.Equal(new DateOnly(2026, 4, 30), evolution.Points[0].MonthEndLocal);
        Assert.True(evolution.Points[^1].IsPartial);
        Assert.All(evolution.Points.SkipLast(1), p => Assert.False(p.IsPartial));
    }

    [Fact]
    public async Task Evolucao_aceita_so_3_6_ou_12_meses()
    {
        var validator = new GetPipelineEvolutionQueryValidator();
        var filter = new DealPipelineFilter();

        Assert.True((await validator.ValidateAsync(new GetPipelineEvolutionQuery(filter, 12), Ct)).IsValid);
        Assert.False((await validator.ValidateAsync(new GetPipelineEvolutionQuery(filter, 4), Ct)).IsValid);
    }

    [Fact]
    public async Task Ingestao_do_n8n_cria_o_negocio_sem_historico_de_valor_e_reenvio_nao_grava_nada()
    {
        using var context = new PipelineTestContext();
        var handler = new ReceiveMetaAdsLeadCommandHandler(context.Db, new Tasks.FakeServiceTokenUser(context.OrganizationId), new RecordingPublisher());
        var command = new ReceiveMetaAdsLeadCommand(
            "lead-123", "Lead Co", "Maria", "+5511999990000", "maria@lead.co", context.SdrUserId, 4_000m, "Campanha de setembro");

        var first = await handler.Handle(command, Ct);
        var again = await handler.Handle(command, Ct);

        Assert.Equal(first.Id, again.Id);
        Assert.Equal(4_000m, first.Ticket);
        Assert.Empty(context.Db.DealValueChanges);
    }
}
