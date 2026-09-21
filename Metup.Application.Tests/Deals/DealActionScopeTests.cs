using Metup.Application.Common.Exceptions;
using Metup.Application.Deals.Commands.ChangeDealStage;
using Metup.Application.Deals.Commands.CloseDeal;
using Metup.Application.Deals.Commands.ReassignDeal;
using Metup.Application.Deals.Commands.UpdateDeal;
using Metup.Application.Deals.Queries.GetDealById;
using Metup.Application.Deals.Queries.ListDeals;
using Metup.Application.Tests.Dashboard;
using Metup.Application.Tests.Tasks;
using Metup.Domain.Common.Exceptions;
using Metup.Domain.Deals;
using Metup.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Metup.Application.Tests.Deals;

/// <summary>
/// Decisão 2 da PL3: as ações de negócio passam por <c>ResolveDealActionScope</c> — SDR só age nos
/// próprios negócios (403 nos de outros); Admin e Closer agem em todos. A <b>leitura</b>
/// (<c>GetDealById</c>, <c>ListDeals</c>) continua aberta à organização.
/// </summary>
public class DealActionScopeTests
{
    private static readonly DateTime Now = PipelineTestContext.NowUtc;

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Sdr_move_o_proprio_negocio_e_recebe_403_no_de_outro()
    {
        using var context = new PipelineTestContext();
        var mine = context.AddDeal(context.SdrUserId, Now.AddDays(-5), amount: 1_000m);
        var others = context.AddDeal(context.AdminUserId, Now.AddDays(-5), amount: 1_000m);
        var handler = context.ChangeStage(context.SdrUserId, UserRole.Sdr);

        var moved = await handler.Handle(new ChangeDealStageCommand(mine.Id, DealStage.Reuniao), Ct);
        Assert.Equal(DealStage.Reuniao, moved.Stage);

        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            handler.Handle(new ChangeDealStageCommand(others.Id, DealStage.Reuniao), Ct));
        Assert.Equal(DealStage.Prospect, (await context.Db.Deals.AsNoTracking().SingleAsync(d => d.Id == others.Id, Ct)).Stage);
    }

    [Fact]
    public async Task Sdr_recebe_403_ao_fechar_ou_editar_o_negocio_de_outro()
    {
        using var context = new PipelineTestContext();
        var others = context.AddDeal(context.AdminUserId, Now.AddDays(-5), amount: 1_000m);

        await Assert.ThrowsAsync<ForbiddenAccessException>(() => context.CloseDeal(context.SdrUserId, UserRole.Sdr)
            .Handle(new CloseDealCommand(others.Id, true, 1_000m), Ct));

        await Assert.ThrowsAsync<ForbiddenAccessException>(() => context.UpdateDeal(context.SdrUserId, UserRole.Sdr)
            .Handle(new UpdateDealCommand(others.Id, null, DealSource.Sdr, context.AdminUserId, null, 2_000m, null), Ct));

        var stored = await context.Db.Deals.AsNoTracking().SingleAsync(d => d.Id == others.Id, Ct);
        Assert.Equal((DealStatus.Aberto, 1_000m), (stored.Status, stored.Amount));
    }

    [Fact]
    public async Task Admin_e_closer_agem_em_qualquer_negocio_da_organizacao()
    {
        using var context = new PipelineTestContext();
        var sdrDeal = context.AddDeal(context.SdrUserId, Now.AddDays(-5), amount: 1_000m);

        var moved = await context.ChangeStage(context.CloserUserId, UserRole.Closer)
            .Handle(new ChangeDealStageCommand(sdrDeal.Id, DealStage.Proposta), Ct);
        Assert.Equal(DealStage.Proposta, moved.Stage);

        var closed = await context.CloseDeal(context.AdminUserId, UserRole.Admin)
            .Handle(new CloseDealCommand(sdrDeal.Id, true, 1_500m), Ct);
        Assert.Equal(DealStatus.Ganho, closed.Status);
    }

    [Fact]
    public async Task Negocio_de_outra_organizacao_continua_404_e_o_service_token_nao_age()
    {
        using var context = new PipelineTestContext();
        var deal = context.AddDeal(context.SdrUserId, Now.AddDays(-5), amount: 1_000m);

        var handler = new ChangeDealStageCommandHandler(
            context.Db, new FakeServiceTokenUser(context.OrganizationId), context.Clock, new RecordingPublisher());

        await Assert.ThrowsAsync<MissingUserContextException>(() =>
            handler.Handle(new ChangeDealStageCommand(deal.Id, DealStage.Reuniao), Ct));

        await Assert.ThrowsAsync<NotFoundException>(() => context.ChangeStage(context.SdrUserId, UserRole.Sdr)
            .Handle(new ChangeDealStageCommand(Guid.NewGuid(), DealStage.Reuniao), Ct));
    }

    [Fact]
    public async Task Leitura_continua_aberta_a_organizacao_para_o_sdr()
    {
        using var context = new PipelineTestContext();
        var others = context.AddDeal(context.AdminUserId, Now.AddDays(-5), amount: 1_000m);

        var byId = await new GetDealByIdQueryHandler(context.Db, context.As(context.SdrUserId, UserRole.Sdr))
            .Handle(new GetDealByIdQuery(others.Id), Ct);
        Assert.Equal(others.Id, byId.Id);

        var list = await context.List(context.SdrUserId, UserRole.Sdr).Handle(new ListDealsQuery(), Ct);
        Assert.Contains(list.Items, d => d.Id == others.Id);
    }

    [Fact]
    public async Task Reatribuir_troca_o_responsavel_e_so_vale_para_admin_e_closer()
    {
        using var context = new PipelineTestContext();
        var deal = context.AddDeal(context.SdrUserId, Now.AddDays(-5), amount: 1_000m);

        var reassigned = await context.Reassign(context.AdminUserId, UserRole.Admin)
            .Handle(new ReassignDealCommand(deal.Id, context.CloserUserId), Ct);
        Assert.Equal(context.CloserUserId, reassigned.OwnerUserId);

        await Assert.ThrowsAsync<ForbiddenAccessException>(() => context.Reassign(context.SdrUserId, UserRole.Sdr)
            .Handle(new ReassignDealCommand(deal.Id, context.SdrUserId), Ct));
    }

    [Fact]
    public async Task Reatribuir_recusa_destino_de_outra_organizacao_e_negocio_fechado()
    {
        using var context = new PipelineTestContext();
        var deal = context.AddDeal(context.SdrUserId, Now.AddDays(-5), amount: 1_000m);
        var handler = context.Reassign(context.AdminUserId, UserRole.Admin);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            handler.Handle(new ReassignDealCommand(deal.Id, Guid.NewGuid()), Ct));

        context.Close(deal, won: true, Now.AddDays(-1), closedAmount: 1_000m);
        await Assert.ThrowsAsync<DomainRuleException>(() =>
            handler.Handle(new ReassignDealCommand(deal.Id, context.CloserUserId), Ct));
    }

    [Fact]
    public void Dominio_recusa_reatribuir_negocio_fechado()
    {
        using var context = new PipelineTestContext();
        var deal = context.AddDeal(context.SdrUserId, Now.AddDays(-5), amount: 1_000m);

        deal.Reassign(context.CloserUserId);
        Assert.Equal(context.CloserUserId, deal.OwnerUserId);

        context.Close(deal, won: false, Now, reason: LostReason.Timing);
        Assert.Throws<DomainRuleException>(() => deal.Reassign(context.AdminUserId));
    }

    [Fact]
    public async Task Ficha_traz_o_valor_efetivo_e_se_ele_e_estimado()
    {
        using var context = new PipelineTestContext();
        var estimated = context.AddDeal(context.SdrUserId, Now.AddDays(-5), ticket: 800m);
        var negotiated = context.AddDeal(context.SdrUserId, Now.AddDays(-5), amount: 1_200m, ticket: 800m);

        var reader = new GetDealByIdQueryHandler(context.Db, context.As(context.AdminUserId, UserRole.Admin));

        var first = await reader.Handle(new GetDealByIdQuery(estimated.Id), Ct);
        Assert.Equal((800m, true), (first.Value, first.ValueIsEstimated));

        var second = await reader.Handle(new GetDealByIdQuery(negotiated.Id), Ct);
        Assert.Equal((1_200m, false), (second.Value, second.ValueIsEstimated));

        // Fechado nunca mostra estimativa: só o valor fechado.
        context.Close(estimated, won: false, Now, reason: LostReason.Timing);
        var closed = await reader.Handle(new GetDealByIdQuery(estimated.Id), Ct);
        Assert.Equal((null, false), (closed.Value, closed.ValueIsEstimated));
    }
}
