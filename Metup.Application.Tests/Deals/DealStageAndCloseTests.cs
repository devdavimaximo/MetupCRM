using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Realtime;
using Metup.Application.Deals.Commands.ChangeDealStage;
using Metup.Application.Deals.Commands.CloseDeal;
using Metup.Application.Deals.Common;
using Metup.Application.Deals.Queries.GetDealBoardCard;
using Metup.Application.Tests.Dashboard;
using Metup.Application.Tests.Tasks;
using Metup.Domain.Common.Exceptions;
using Metup.Domain.Deals;
using Metup.Domain.Integrations;
using Metup.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Metup.Application.Tests.Deals;

public class DealStageAndCloseTests
{
    private static readonly DateTime Now = PipelineTestContext.NowUtc;

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Etapa_esperada_diferente_da_atual_e_conflito_com_o_estado_atual_e_nada_muda()
    {
        using var context = new PipelineTestContext();
        var deal = context.AddDeal(context.SdrUserId, Now.AddDays(-5), amount: 1_000m, path: [DealStage.Reuniao]);
        var publisher = new RecordingPublisher();

        var conflict = await Assert.ThrowsAsync<StaleStateException>(() => Handler(context, publisher).Handle(
            new ChangeDealStageCommand(deal.Id, DealStage.Proposta, ExpectedFromStage: DealStage.Qualificacao), Ct));

        var current = Assert.IsType<DealDto>(conflict.CurrentState);
        Assert.Equal((deal.Id, DealStage.Reuniao), (current.Id, current.Stage));
        Assert.Equal(2, await context.Db.StageChanges.CountAsync(sc => sc.DealId == deal.Id, Ct));
        Assert.Empty(context.Db.IntegrationEvents);
        Assert.Empty(publisher.Published);
    }

    [Fact]
    public async Task Mesma_etapa_e_sucesso_sem_transicao_evento_nem_aviso()
    {
        using var context = new PipelineTestContext();
        var deal = context.AddDeal(context.SdrUserId, Now.AddDays(-5), amount: 1_000m, path: [DealStage.Reuniao]);
        var publisher = new RecordingPublisher();

        // Com ou sem etapa esperada — inclusive uma esperada "velha", que é o reenvio de um arrasto já aplicado.
        var plain = await Handler(context, publisher).Handle(new ChangeDealStageCommand(deal.Id, DealStage.Reuniao), Ct);
        var resent = await Handler(context, publisher).Handle(
            new ChangeDealStageCommand(deal.Id, DealStage.Reuniao, ExpectedFromStage: DealStage.Qualificacao), Ct);

        Assert.Equal(DealStage.Reuniao, plain.Stage);
        Assert.Equal(DealStage.Reuniao, resent.Stage);
        Assert.Equal(2, plain.StageHistory.Count);
        Assert.Empty(context.Db.IntegrationEvents);
        Assert.Empty(publisher.Published);
    }

    [Fact]
    public async Task Mudanca_real_grava_uma_transicao_um_stage_changed_e_um_aviso()
    {
        using var context = new PipelineTestContext();
        var deal = context.AddDeal(context.SdrUserId, Now.AddDays(-5), amount: 1_000m, path: [DealStage.Reuniao]);
        var publisher = new RecordingPublisher();

        var moved = await Handler(context, publisher).Handle(
            new ChangeDealStageCommand(deal.Id, DealStage.Proposta, ExpectedFromStage: DealStage.Reuniao), Ct);

        Assert.Equal(DealStage.Proposta, moved.Stage);
        var last = moved.StageHistory[^1];
        Assert.Equal((DealStage.Reuniao, DealStage.Proposta, Now, context.AdminUserId), (last.FromStage, last.ToStage, last.ChangedAt, last.ChangedByUserId));
        var integrationEvent = Assert.Single(context.Db.IntegrationEvents);
        Assert.Equal(IntegrationEventTypes.StageChanged, integrationEvent.Type);
        Assert.Equal(new DealStageChangedNotification(context.OrganizationId, deal.Id, context.SdrUserId), Assert.Single(publisher.Published));

        // O cartão (?view=card) já mostra a etapa nova e o tempo zerado.
        var card = await new GetDealBoardCardQueryHandler(
                context.As(context.AdminUserId, UserRole.Admin), context.Clock, context.Db, context.Reader())
            .Handle(new GetDealBoardCardQuery(deal.Id), Ct);
        Assert.Equal((DealStage.Proposta, Now, 0, false), (card.Stage, card.StageEnteredAt, card.DaysInStage, card.IsStalled));
    }

    [Fact]
    public async Task Negocio_fechado_por_outro_usuario_e_conflito_ao_arrastar()
    {
        using var context = new PipelineTestContext();
        var deal = context.AddDeal(context.SdrUserId, Now.AddDays(-5), amount: 1_000m, path: [DealStage.Negociacao]);
        context.Close(deal, won: true, Now.AddHours(-1));

        var conflict = await Assert.ThrowsAsync<StaleStateException>(() => Handler(context, new RecordingPublisher()).Handle(
            new ChangeDealStageCommand(deal.Id, DealStage.Proposta, ExpectedFromStage: DealStage.Negociacao), Ct));

        Assert.Equal(DealStatus.Ganho, Assert.IsType<DealDto>(conflict.CurrentState).Status);
    }

    [Fact]
    public async Task Fechar_como_perdido_grava_motivo_e_nota()
    {
        using var context = new PipelineTestContext();
        var deal = context.AddDeal(context.SdrUserId, Now.AddDays(-5), amount: 1_000m);
        var handler = new CloseDealCommandHandler(
            context.Db, context.As(context.SdrUserId, UserRole.Sdr), context.Clock, new RecordingPublisher());

        var closed = await handler.Handle(new CloseDealCommand(deal.Id, false, null, LostReason.Preco, "  Achou caro  "), Ct);

        Assert.Equal((DealStatus.Perdido, LostReason.Preco, "Achou caro", Now), (closed.Status, closed.LostReason, closed.LostNote, closed.ClosedAt));
    }

    [Fact]
    public void Validador_exige_motivo_no_perdido_e_recusa_no_ganho()
    {
        var validator = new CloseDealCommandValidator();
        var id = Guid.NewGuid();

        Assert.False(validator.Validate(new CloseDealCommand(id, false, null)).IsValid);
        Assert.False(validator.Validate(new CloseDealCommand(id, false, null, (LostReason)99)).IsValid);
        Assert.False(validator.Validate(new CloseDealCommand(id, false, null, LostReason.Outro, new string('x', 281))).IsValid);
        Assert.True(validator.Validate(new CloseDealCommand(id, false, null, LostReason.Outro, new string('x', 280))).IsValid);
        Assert.True(validator.Validate(new CloseDealCommand(id, false, 0m, LostReason.Timing)).IsValid);

        Assert.False(validator.Validate(new CloseDealCommand(id, true, 100m, LostReason.Preco)).IsValid);
        Assert.False(validator.Validate(new CloseDealCommand(id, true, 100m, null, "nota")).IsValid);
        Assert.True(validator.Validate(new CloseDealCommand(id, true, 100m)).IsValid);
    }

    [Fact]
    public void Dominio_protege_o_motivo_mesmo_fora_da_API()
    {
        using var context = new PipelineTestContext();
        var deal = context.AddDeal(context.SdrUserId, Now.AddDays(-5), amount: 1_000m);

        Assert.Throws<DomainRuleException>(() => deal.Close(false, null, null, null, context.SdrUserId, Now));
        Assert.Throws<DomainRuleException>(() => deal.Close(true, null, LostReason.Preco, null, context.SdrUserId, Now));
        Assert.Throws<DomainRuleException>(() => deal.Close(false, null, LostReason.Outro, new string('x', 281), context.SdrUserId, Now));
        Assert.Equal(DealStatus.Aberto, deal.Status);
    }

    [Fact]
    public async Task Service_token_do_n8n_nao_fecha_negocio()
    {
        using var context = new PipelineTestContext();
        var deal = context.AddDeal(context.SdrUserId, Now.AddDays(-5), amount: 1_000m);
        var handler = new CloseDealCommandHandler(context.Db, new FakeServiceTokenUser(context.OrganizationId), context.Clock, new RecordingPublisher());

        await Assert.ThrowsAsync<MissingUserContextException>(() =>
            handler.Handle(new CloseDealCommand(deal.Id, false, null, LostReason.Outro), Ct));
        Assert.Equal(DealStatus.Aberto, (await context.Db.Deals.AsNoTracking().SingleAsync(d => d.Id == deal.Id, Ct)).Status);
    }

    private static ChangeDealStageCommandHandler Handler(PipelineTestContext context, RecordingPublisher publisher) =>
        new(context.Db, context.As(context.AdminUserId, UserRole.Admin), context.Clock, publisher);
}
