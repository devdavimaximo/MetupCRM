using Metup.Application.Deals.Common;
using Metup.Application.Deals.Queries.GetDealBoard;
using Metup.Application.Deals.Queries.GetDealBoardColumn;
using Metup.Application.Deals.Queries.ListDeals;
using Metup.Application.Tests.Dashboard;
using Metup.Domain.Deals;
using Metup.Domain.Users;
using Xunit;

namespace Metup.Application.Tests.Deals;

public class DealBoardTests
{
    private static readonly DateTime Now = PipelineTestContext.NowUtc;
    private static readonly DealPipelineFilter AllOwners = new(AllOwners: true);

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Theory]
    [InlineData(UserRole.Admin, true)]
    [InlineData(UserRole.Sdr, false)]
    public async Task Contagem_e_soma_de_cada_coluna_batem_com_a_listagem_e_o_DealValue(UserRole role, bool allOwners)
    {
        using var context = new PipelineTestContext();
        Seed(context);
        var userId = role == UserRole.Admin ? context.AdminUserId : context.SdrUserId;

        var board = await context.Board(userId, role).Handle(
            new GetDealBoardQuery(new DealPipelineFilter(AllOwners: allOwners), PerColumn: 1), Ct);

        foreach (var column in board.Columns)
        {
            // Mesmo recorte na listagem: a organização inteira para o Admin, a carteira do SDR para ele.
            var listed = (await context.List(userId, role).Handle(
                    new ListDealsQuery(column.Stage, allOwners ? null : userId, PageSize: 200), Ct))
                .Items
                .Where(d => d.Status == DealStatus.Aberto)
                .ToList();

            Assert.Equal(listed.Count, column.Count);
            Assert.Equal(listed.Sum(d => DealValue.EffectiveAmount(d.Amount, d.Ticket) ?? 0m), column.Total);
            Assert.Equal(listed.Any(d => DealValue.IsEstimated(d.Amount, d.Ticket)), column.TotalHasEstimate);
            Assert.Equal(listed.Count > 1, column.HasMore);
        }

        Assert.Equal(DealBoardReader.ActiveStages, board.Columns.Select(c => c.Stage));
        Assert.Contains(board.Columns, c => c.Count > 0);
    }

    [Fact]
    public async Task Etapas_ativas_ignoram_o_periodo_e_Fechados_conta_so_o_periodo()
    {
        using var context = new PipelineTestContext();
        var old = context.AddDeal(context.AdminUserId, Now.AddDays(-200), amount: 1_000m);
        var wonInPeriod = context.AddDeal(context.AdminUserId, Now.AddDays(-50), ticket: 7_000m);
        context.Close(wonInPeriod, won: true, Now.AddDays(-3), closedAmount: 6_000m);
        var wonBefore = context.AddDeal(context.AdminUserId, Now.AddDays(-90), amount: 9_000m);
        context.Close(wonBefore, won: true, Now.AddDays(-45));
        var lostInPeriod = context.AddDeal(context.AdminUserId, Now.AddDays(-20), ticket: 3_000m);
        context.Close(lostInPeriod, won: false, Now.AddDays(-1), reason: LostReason.Concorrente);

        var board = await context.Board(context.AdminUserId, UserRole.Admin).Handle(new GetDealBoardQuery(AllOwners), Ct);

        Assert.Equal(old.Id, Assert.Single(board.Columns.Single(c => c.Stage == DealStage.Prospect).Items).Id);
        Assert.Equal(new DateOnly(2026, 8, 17), board.PeriodStartLocal);
        Assert.Equal(new DateOnly(2026, 9, 15), board.PeriodEndLocal);

        var won = board.Closed.Won;
        Assert.Equal(DealStage.Ganho, won.Stage);
        Assert.Equal(1, won.Count);
        Assert.Equal(6_000m, won.Total);
        Assert.False(won.TotalHasEstimate);
        Assert.Equal(wonInPeriod.Id, Assert.Single(won.Items).Id);

        var lost = board.Closed.Lost;
        Assert.Equal(1, lost.Count);
        // Perdido sem valor fechado soma zero: fechado nunca usa o ticket.
        Assert.Equal(0m, lost.Total);
        var lostCard = Assert.Single(lost.Items);
        Assert.Equal(LostReason.Concorrente, lostCard.LostReason);
        Assert.Null(lostCard.Value);
        Assert.False(lostCard.ValueIsEstimated);

        // Período que cobre o ganho antigo: ele entra; o recente, não.
        var earlier = await context.Board(context.AdminUserId, UserRole.Admin).Handle(
            new GetDealBoardQuery(AllOwners, new DateOnly(2026, 7, 1), new DateOnly(2026, 8, 15)), Ct);
        Assert.Equal(wonBefore.Id, Assert.Single(earlier.Closed.Won.Items).Id);
        Assert.Equal(old.Id, Assert.Single(earlier.Columns.Single(c => c.Stage == DealStage.Prospect).Items).Id);
    }

    [Fact]
    public async Task Filtros_de_origem_segmento_e_busca_valem_para_contagem_e_itens()
    {
        using var context = new PipelineTestContext();
        var whatsApp = context.AddDeal(context.AdminUserId, Now.AddDays(-5), amount: 100m, source: DealSource.WhatsApp);
        var retail = context.AddDeal(context.AdminUserId, Now.AddDays(-5), amount: 200m, retail: true);
        context.AddDeal(context.AdminUserId, Now.AddDays(-5), amount: 400m);
        var handler = context.Board(context.AdminUserId, UserRole.Admin);

        async Task<IReadOnlyList<Guid>> Ids(DealPipelineFilter filter)
        {
            var prospect = (await handler.Handle(new GetDealBoardQuery(filter), Ct)).Columns.Single(c => c.Stage == DealStage.Prospect);
            Assert.Equal(prospect.Items.Count, prospect.Count);
            return prospect.Items.Select(i => i.Id).ToList();
        }

        Assert.Equal(whatsApp.Id, Assert.Single(await Ids(AllOwners with { Sources = [DealSource.WhatsApp] })));
        Assert.Equal(retail.Id, Assert.Single(await Ids(AllOwners with { Segments = ["Varejo"] })));
        // Busca sem acento nem caixa, no contato e na empresa.
        Assert.Equal(retail.Id, Assert.Single(await Ids(AllOwners with { Search = "joao avila" })));
        Assert.Equal(retail.Id, Assert.Single(await Ids(AllOwners with { Search = "PADARIA" })));
        Assert.Equal(3, (await Ids(AllOwners with { Search = "  " })).Count);
    }

    [Fact]
    public async Task Escopo_segue_o_dashboard_e_rebaixa_o_SDR_em_silencio()
    {
        using var context = new PipelineTestContext();
        var adminDeal = context.AddDeal(context.AdminUserId, Now.AddDays(-5), amount: 100m);
        var sdrDeal = context.AddDeal(context.SdrUserId, Now.AddDays(-5), amount: 200m);

        async Task AssertSees(Guid userId, UserRole role, DealPipelineFilter filter, Guid? expectedOwner, params Guid[] expectedIds)
        {
            var board = await context.Board(userId, role).Handle(new GetDealBoardQuery(filter), Ct);
            Assert.Equal(expectedOwner, board.OwnerUserId);
            Assert.Equal(expectedIds.Order(), board.Columns.SelectMany(c => c.Items).Select(i => i.Id).Order());
        }

        // SDR: os próprios, peça o que pedir.
        await AssertSees(context.SdrUserId, UserRole.Sdr, new DealPipelineFilter(), context.SdrUserId, sdrDeal.Id);
        await AssertSees(context.SdrUserId, UserRole.Sdr, AllOwners, context.SdrUserId, sdrDeal.Id);
        await AssertSees(context.SdrUserId, UserRole.Sdr, new DealPipelineFilter(context.AdminUserId), context.SdrUserId, sdrDeal.Id);

        // Admin/Closer: sem pedido = os próprios; todos; ou a carteira pedida.
        await AssertSees(context.AdminUserId, UserRole.Admin, new DealPipelineFilter(), context.AdminUserId, adminDeal.Id);
        await AssertSees(context.CloserUserId, UserRole.Closer, AllOwners, null, adminDeal.Id, sdrDeal.Id);
        await AssertSees(context.CloserUserId, UserRole.Closer, new DealPipelineFilter(context.SdrUserId), context.SdrUserId, sdrDeal.Id);
    }

    [Fact]
    public async Task Ordenacoes_desempatam_pelo_id()
    {
        using var context = new PipelineTestContext();
        // Dois negócios idênticos em tudo que ordena (mesmo instante, valor e previsão): só o Id desempata.
        var twinA = context.AddDeal(context.AdminUserId, Now.AddDays(-10), amount: 500m, expectedCloseDate: new DateOnly(2026, 10, 1));
        var twinB = context.AddDeal(context.AdminUserId, Now.AddDays(-10), amount: 500m, expectedCloseDate: new DateOnly(2026, 10, 1));
        var oldest = context.AddDeal(context.AdminUserId, Now.AddDays(-30), amount: 100m, expectedCloseDate: new DateOnly(2026, 9, 20));
        var newest = context.AddDeal(context.AdminUserId, Now.AddDays(-1), amount: 900m);
        var noValue = context.AddDeal(context.AdminUserId, Now.AddDays(-20));
        var twins = new[] { twinA.Id, twinB.Id }.Order().ToArray();

        async Task<Guid[]> Order(DealBoardSort sort) =>
            (await context.Board(context.AdminUserId, UserRole.Admin).Handle(new GetDealBoardQuery(AllOwners, Sort: sort), Ct))
            .Columns.Single(c => c.Stage == DealStage.Prospect).Items.Select(i => i.Id).ToArray();

        Guid[] stalledFirst = [oldest.Id, noValue.Id, .. twins, newest.Id];
        Guid[] valueDesc = [newest.Id, .. twins, oldest.Id, noValue.Id];
        Guid[] recent = [newest.Id, .. twins, noValue.Id, oldest.Id];
        Guid[] expectedClose = [oldest.Id, .. twins, .. new[] { newest.Id, noValue.Id }.Order()];

        Assert.Equal(stalledFirst, await Order(DealBoardSort.Stalled));
        Assert.Equal(valueDesc, await Order(DealBoardSort.ValueDesc));
        Assert.Equal(recent, await Order(DealBoardSort.Recent));
        Assert.Equal(expectedClose, await Order(DealBoardSort.ExpectedClose));

        // Repetir a leitura dá a mesma ordem (nenhuma dependência de ordem de inserção).
        Assert.Equal(await Order(DealBoardSort.ValueDesc), await Order(DealBoardSort.ValueDesc));
    }

    [Fact]
    public async Task Amostra_por_coluna_e_carregar_mais_pela_coluna()
    {
        using var context = new PipelineTestContext();
        for (var i = 0; i < 3; i++)
        {
            context.AddDeal(context.AdminUserId, Now.AddDays(-10 - i), amount: 100m * (i + 1));
        }

        var won = context.AddDeal(context.AdminUserId, Now.AddDays(-20), amount: 50m);
        context.Close(won, won: true, Now.AddDays(-2));

        var board = await context.Board(context.AdminUserId, UserRole.Admin).Handle(new GetDealBoardQuery(AllOwners, PerColumn: 2), Ct);
        var prospect = board.Columns.Single(c => c.Stage == DealStage.Prospect);
        Assert.Equal((3, 600m, 2, true), (prospect.Count, prospect.Total, prospect.Items.Count, prospect.HasMore));

        var column = context.Column(context.AdminUserId, UserRole.Admin);
        var page2 = await column.Handle(new GetDealBoardColumnQuery(AllOwners, DealStage.Prospect, Page: 2, PerColumn: 2), Ct);
        Assert.Equal((3, 600m, 2, 1, false), (page2.Count, page2.Total, page2.Page, page2.Items.Count, page2.HasMore));
        Assert.DoesNotContain(page2.Items[0].Id, prospect.Items.Select(i => i.Id));

        var closedWon = await column.Handle(new GetDealBoardColumnQuery(AllOwners, Closed: DealBoardClosedGroup.Won), Ct);
        Assert.Equal((DealStage.Ganho, 1, 50m), (closedWon.Stage, closedWon.Count, closedWon.Total));
    }

    [Fact]
    public async Task Coluna_exige_etapa_ativa_ou_grupo_de_fechados_e_periodo_valido()
    {
        var validator = new GetDealBoardColumnQueryValidator(new FakeOrganizationClock(DashboardOverviewTestContext.SaoPaulo, Now));

        async Task<bool> Valid(GetDealBoardColumnQuery query) => (await validator.ValidateAsync(query, Ct)).IsValid;

        Assert.False(await Valid(new GetDealBoardColumnQuery(AllOwners)));
        Assert.False(await Valid(new GetDealBoardColumnQuery(AllOwners, DealStage.Prospect, DealBoardClosedGroup.Won)));
        Assert.False(await Valid(new GetDealBoardColumnQuery(AllOwners, DealStage.Ganho)));
        // A coluna pagina até 100 (a lista lateral do "Ver todos", item 16 da PL3); o quadro, até 50.
        Assert.True(await Valid(new GetDealBoardColumnQuery(AllOwners, DealStage.Prospect, PerColumn: 100)));
        Assert.False(await Valid(new GetDealBoardColumnQuery(AllOwners, DealStage.Prospect, PerColumn: 101)));
        Assert.False(await Valid(new GetDealBoardColumnQuery(AllOwners, DealStage.Prospect, From: new DateOnly(2026, 9, 1))));
        Assert.False(await Valid(new GetDealBoardColumnQuery(AllOwners, DealStage.Prospect, From: new DateOnly(2026, 9, 1), To: new DateOnly(2026, 9, 16))));
        Assert.True(await Valid(new GetDealBoardColumnQuery(AllOwners, DealStage.Proposta, From: new DateOnly(2026, 9, 1), To: new DateOnly(2026, 9, 15))));
        Assert.True(await Valid(new GetDealBoardColumnQuery(AllOwners, Closed: DealBoardClosedGroup.Lost)));
    }

    [Fact]
    public async Task Cartao_traz_tempo_na_etapa_parado_ultima_atividade_e_proxima_tarefa()
    {
        using var context = new PipelineTestContext();
        // Criado há 30 dias, entrou em Qualificação há 29 (limite padrão de parado: 14 dias).
        var stalled = context.AddDeal(context.AdminUserId, Now.AddDays(-30), ticket: 8_000m, path: [DealStage.Qualificacao]);
        context.AddActivity(stalled, Now.AddHours(-5));
        context.AddActivity(stalled, Now.AddDays(-3));
        context.AddTask(stalled, Now.AddDays(-4), completed: true);
        var overdue = context.AddTask(stalled, Now.AddDays(-1));
        context.AddTask(stalled, Now.AddDays(2));

        var fresh = context.AddDeal(context.AdminUserId, Now.AddDays(-2), amount: 1_000m, ticket: 800m);

        var board = await context.Board(context.AdminUserId, UserRole.Admin).Handle(new GetDealBoardQuery(AllOwners), Ct);
        var card = Assert.Single(board.Columns.Single(c => c.Stage == DealStage.Qualificacao).Items);

        Assert.Equal("Empresa Alfa", card.CompanyName);
        Assert.Equal("Ana Admin", card.OwnerUserName);
        Assert.Equal((8_000m, true), (card.Value, card.ValueIsEstimated));
        Assert.Equal(Now.AddDays(-29), card.StageEnteredAt);
        Assert.Equal((29, true), (card.DaysInStage, card.IsStalled));
        Assert.Equal(Now.AddHours(-5), card.LastActivityAt);
        Assert.Equal(new DealBoardNextTaskDto(overdue.Type, overdue.DueDate, true), card.NextTask);

        var freshCard = Assert.Single(board.Columns.Single(c => c.Stage == DealStage.Prospect).Items);
        Assert.Equal(fresh.Id, freshCard.Id);
        Assert.Equal((1_000m, false, false), (freshCard.Value, freshCard.ValueIsEstimated, freshCard.IsStalled));
        Assert.Null(freshCard.LastActivityAt);
        Assert.Null(freshCard.NextTask);
    }

    private static void Seed(PipelineTestContext context)
    {
        context.AddDeal(context.AdminUserId, Now.AddDays(-40), amount: 1_000m);
        context.AddDeal(context.AdminUserId, Now.AddDays(-35), ticket: 2_500m);
        context.AddDeal(context.SdrUserId, Now.AddDays(-30), amount: 3_000m, ticket: 9_000m);
        context.AddDeal(context.SdrUserId, Now.AddDays(-25), ticket: 4_000m, path: [DealStage.PrimeiroContato, DealStage.Qualificacao]);
        context.AddDeal(context.AdminUserId, Now.AddDays(-20), path: [DealStage.Qualificacao]);
        context.AddDeal(context.SdrUserId, Now.AddDays(-15), amount: 12_000m, path: [DealStage.Proposta]);
        context.AddDeal(context.CloserUserId, Now.AddDays(-10), ticket: 6_000m, path: [DealStage.Proposta]);
        var won = context.AddDeal(context.SdrUserId, Now.AddDays(-50), amount: 5_000m, path: [DealStage.Proposta]);
        context.Close(won, won: true, Now.AddDays(-5));
    }
}
