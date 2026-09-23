using Metup.Application.Activities.Common;
using Metup.Application.Activities.Queries.ListActivityFeed;
using Metup.Application.Tests.Dashboard;
using Metup.Domain.Activities;
using Metup.Domain.Deals;
using Metup.Domain.Users;
using Xunit;

namespace Metup.Application.Tests.Activities;

public class ActivityFeedTests
{
    private static readonly DateTime BaseUtc = new(2026, 9, 15, 17, 0, 0, DateTimeKind.Utc);

    private static ListActivityFeedQueryHandler Handler(DashboardOverviewTestContext context, Guid userId, DefaultRole role) =>
        new(context.As(userId, role), new ActivityFeedReader(context.Db, new FakeOrganizationClock(DashboardOverviewTestContext.SaoPaulo, BaseUtc)));

    private static void AddActivity(DashboardOverviewTestContext context, Deal deal, Guid authorUserId, DateTime occurredAt, ActivityType type = ActivityType.Note)
    {
        context.Db.Activities.Add(Activity.Log(
            context.OrganizationId, deal.Id, null, type,
            type == ActivityType.Call ? ActivityOutcome.Atendeu : null, null, authorUserId, occurredAt));
        context.Db.SaveChanges();
    }

    /// <summary>Lê todas as páginas seguindo o cursor, como o front faz ao rolar.</summary>
    private static async Task<List<ActivityFeedItemDto>> ReadAllAsync(
        ListActivityFeedQueryHandler handler,
        int pageSize,
        IReadOnlyList<ActivityFeedFilter>? kinds = null,
        Guid? ownerUserId = null)
    {
        var all = new List<ActivityFeedItemDto>();
        string? cursor = null;
        for (var guard = 0; guard < 100; guard++)
        {
            var page = await handler.Handle(new ListActivityFeedQuery(cursor, kinds, ownerUserId, pageSize), TestContext.Current.CancellationToken);
            Assert.True(page.Items.Count <= pageSize);
            all.AddRange(page.Items);
            if (page.NextCursor is null)
            {
                return all;
            }

            Assert.NotEmpty(page.Items);
            cursor = page.NextCursor;
        }

        throw new InvalidOperationException("O cursor não terminou.");
    }

    [Fact]
    public async Task Paginacao_nao_duplica_nem_pula_com_instantes_iguais_nas_duas_fontes()
    {
        using var context = new DashboardOverviewTestContext();
        var deal = context.AddOpenDeal(context.AdminUserId, amount: 1_000m, ticket: null, BaseUtc.AddDays(-30));

        // 64 atividades em só 4 instantes distintos (16 empates em cada), mais transições no mesmo instante:
        // toda borda de página cai no meio de um grupo empatado.
        for (var i = 0; i < 64; i++)
        {
            AddActivity(context, deal, context.AdminUserId, BaseUtc.AddMinutes(-(i % 4)));
        }

        var tied = context.AddOpenDeal(context.AdminUserId, amount: 2_000m, ticket: null, BaseUtc.AddMinutes(-2));
        var expectedTotal = 64 + context.Db.StageChanges.Count(sc => sc.DealId == deal.Id) + context.Db.StageChanges.Count(sc => sc.DealId == tied.Id);

        foreach (var pageSize in new[] { 1, 7, 20 })
        {
            var all = await ReadAllAsync(Handler(context, context.AdminUserId, DefaultRole.Admin), pageSize);

            Assert.Equal(expectedTotal, all.Count);
            Assert.Equal(all.Count, all.Select(e => e.Id).Distinct().Count());
            Assert.Equal(all.OrderByDescending(e => e.OccurredAt).Select(e => e.OccurredAt), all.Select(e => e.OccurredAt));
        }
    }

    [Fact]
    public async Task Pagina_padrao_tem_20_itens_e_cursor_ate_o_fim()
    {
        using var context = new DashboardOverviewTestContext();
        var deal = context.AddOpenDeal(context.AdminUserId, amount: null, ticket: null, BaseUtc.AddDays(-10));
        for (var i = 0; i < 44; i++)
        {
            AddActivity(context, deal, context.AdminUserId, BaseUtc.AddMinutes(-i));
        }

        var handler = Handler(context, context.AdminUserId, DefaultRole.Admin);
        var first = await handler.Handle(new ListActivityFeedQuery(), TestContext.Current.CancellationToken);
        var second = await handler.Handle(new ListActivityFeedQuery(first.NextCursor), TestContext.Current.CancellationToken);
        var third = await handler.Handle(new ListActivityFeedQuery(second.NextCursor), TestContext.Current.CancellationToken);

        Assert.Equal(20, first.Items.Count);
        Assert.Equal(20, second.Items.Count);
        Assert.Equal(5, third.Items.Count); // 44 atividades + o nascimento do negócio
        Assert.Null(third.NextCursor);
        Assert.Equal(ActivityFeedKind.DealCreated, third.Items[^1].Kind);
    }

    [Fact]
    public async Task Filtros_por_tipo_de_evento_e_de_atividade()
    {
        using var context = new DashboardOverviewTestContext();
        var won = context.AddWonDeal(context.AdminUserId, 9_000m, BaseUtc.AddDays(-5), BaseUtc.AddDays(-1));
        var lost = context.AddClosedDeal(context.AdminUserId, won: false, amount: null, BaseUtc.AddDays(-5), BaseUtc.AddDays(-2));
        var advanced = context.AddOpenDeal(context.AdminUserId, amount: null, ticket: null, BaseUtc.AddDays(-4), DealStage.Reuniao);
        AddActivity(context, advanced, context.AdminUserId, BaseUtc.AddHours(-3), ActivityType.Call);
        AddActivity(context, advanced, context.AdminUserId, BaseUtc.AddHours(-2), ActivityType.Meeting);

        var handler = Handler(context, context.AdminUserId, DefaultRole.Admin);

        var wins = await ReadAllAsync(handler, 10, [ActivityFeedFilter.DealWon]);
        var item = Assert.Single(wins);
        Assert.Equal(won.Id, item.DealId);
        Assert.Equal(9_000m, item.Amount);
        Assert.Equal("Empresa Alfa", item.CompanyName);
        Assert.Equal("Ana Admin", item.ActorName);

        Assert.Equal(lost.Id, Assert.Single(await ReadAllAsync(handler, 10, [ActivityFeedFilter.DealLost])).DealId);
        Assert.Equal(DealStage.Reuniao, Assert.Single(await ReadAllAsync(handler, 10, [ActivityFeedFilter.StageAdvanced])).ToStage);
        Assert.Equal(3, (await ReadAllAsync(handler, 10, [ActivityFeedFilter.DealCreated])).Count);

        var calls = await ReadAllAsync(handler, 10, [ActivityFeedFilter.Call]);
        Assert.Equal(ActivityType.Call, Assert.Single(calls).ActivityType);

        var mixed = await ReadAllAsync(handler, 10, [ActivityFeedFilter.Meeting, ActivityFeedFilter.DealWon]);
        Assert.Equal([ActivityFeedKind.Activity, ActivityFeedKind.DealWon], mixed.Select(e => e.Kind));
    }

    [Fact]
    public async Task SDR_ve_tudo_dos_proprios_negocios_e_nada_dos_alheios_mesmo_pedindo_outro_responsavel()
    {
        using var context = new DashboardOverviewTestContext();
        var mine = context.AddOpenDeal(context.SdrUserId, amount: null, ticket: null, BaseUtc.AddDays(-3));
        var others = context.AddOpenDeal(context.AdminUserId, amount: null, ticket: null, BaseUtc.AddDays(-3));
        for (var i = 0; i < 30; i++)
        {
            // O Admin registrando no negócio do SDR ainda é do SDR; o SDR registrando no negócio alheio não é.
            AddActivity(context, mine, context.AdminUserId, BaseUtc.AddMinutes(-i));
            AddActivity(context, others, context.SdrUserId, BaseUtc.AddMinutes(-i));
        }

        var handler = Handler(context, context.SdrUserId, DefaultRole.Sdr);

        var feed = await ReadAllAsync(handler, 20);
        Assert.Equal(31, feed.Count);
        Assert.All(feed, e => Assert.Equal(mine.Id, e.DealId));

        var tryingOthers = await ReadAllAsync(handler, 20, ownerUserId: context.AdminUserId);
        Assert.All(tryingOthers, e => Assert.Equal(mine.Id, e.DealId));
    }

    [Fact]
    public async Task DealId_restringe_a_um_negocio_e_ignora_o_escopo_por_responsavel()
    {
        using var context = new DashboardOverviewTestContext();
        var sdrDeal = context.AddOpenDeal(context.SdrUserId, amount: null, ticket: null, BaseUtc.AddDays(-3));
        var adminDeal = context.AddOpenDeal(context.AdminUserId, amount: null, ticket: null, BaseUtc.AddDays(-3));
        AddActivity(context, sdrDeal, context.SdrUserId, BaseUtc.AddHours(-2));
        AddActivity(context, adminDeal, context.AdminUserId, BaseUtc.AddHours(-1));

        // O SDR só enxerga os próprios negócios em qualquer outro filtro, mas pedir um negócio
        // específico (painel de contexto das Conversas) alcança a organização inteira — item 20.
        var handler = Handler(context, context.SdrUserId, DefaultRole.Sdr);
        var feed = await handler.Handle(new ListActivityFeedQuery(DealId: adminDeal.Id), TestContext.Current.CancellationToken);

        Assert.All(feed.Items, item => Assert.Equal(adminDeal.Id, item.DealId));
        Assert.Contains(feed.Items, item => item.Kind == ActivityFeedKind.DealCreated);
        Assert.Contains(feed.Items, item => item.Kind == ActivityFeedKind.Activity);

        // Sem DealId, o comportamento de hoje (escopo do SDR) continua valendo — regressão zero.
        var withoutDealId = await handler.Handle(new ListActivityFeedQuery(), TestContext.Current.CancellationToken);
        Assert.All(withoutDealId.Items, item => Assert.Equal(sdrDeal.Id, item.DealId));
    }

    [Fact]
    public async Task Admin_filtra_por_responsavel_do_negocio()
    {
        using var context = new DashboardOverviewTestContext();
        var sdrDeal = context.AddOpenDeal(context.SdrUserId, amount: null, ticket: null, BaseUtc.AddDays(-3));
        context.AddOpenDeal(context.AdminUserId, amount: null, ticket: null, BaseUtc.AddDays(-3));
        AddActivity(context, sdrDeal, context.AdminUserId, BaseUtc);

        var feed = await ReadAllAsync(Handler(context, context.AdminUserId, DefaultRole.Admin), 20, ownerUserId: context.SdrUserId);

        Assert.Equal(2, feed.Count);
        Assert.All(feed, e => Assert.Equal(sdrDeal.Id, e.DealId));
    }

    [Theory]
    [InlineData("não-é-base64", 20, false)]
    [InlineData(null, 0, false)]
    [InlineData(null, 51, false)]
    [InlineData(null, 50, true)]
    public async Task Validador_recusa_cursor_invalido_e_pagina_fora_da_faixa(string? cursor, int pageSize, bool valid)
    {
        var result = await new ListActivityFeedQueryValidator()
            .ValidateAsync(new ListActivityFeedQuery(cursor, null, null, pageSize), TestContext.Current.CancellationToken);

        Assert.Equal(valid, result.IsValid);
    }

    [Fact]
    public async Task Dia_local_segue_o_fuso_da_organizacao_e_nao_o_UTC()
    {
        using var context = new DashboardOverviewTestContext();
        var deal = context.AddOpenDeal(context.AdminUserId, amount: 1_000m, ticket: null, BaseUtc.AddDays(-30));

        // 23h30 de 14/09 em Brasília já é 15/09 em UTC; 00h10 de 15/09 em Brasília ainda é 15/09 em UTC.
        var lateNight = new DateTime(2026, 9, 15, 2, 30, 0, DateTimeKind.Utc);
        var afterMidnight = new DateTime(2026, 9, 15, 3, 10, 0, DateTimeKind.Utc);
        AddActivity(context, deal, context.AdminUserId, lateNight);
        AddActivity(context, deal, context.AdminUserId, afterMidnight);

        var feed = await ReadAllAsync(Handler(context, context.AdminUserId, DefaultRole.Admin), 20, [ActivityFeedFilter.Note]);

        Assert.Equal(new DateOnly(2026, 9, 14), feed.Single(e => e.OccurredAt == lateNight).OccurredOnLocal);
        Assert.Equal(new DateOnly(2026, 9, 15), feed.Single(e => e.OccurredAt == afterMidnight).OccurredOnLocal);
    }

    [Fact]
    public void Cursor_ida_e_volta()
    {
        var cursor = new ActivityFeedCursor(new DateTime(2026, 9, 15, 17, 0, 0, 123, DateTimeKind.Utc).AddTicks(4560), Guid.NewGuid());

        Assert.True(ActivityFeedCursor.TryDecode(cursor.Encode(), out var decoded));
        Assert.Equal(cursor, decoded);
        Assert.False(ActivityFeedCursor.TryDecode(Convert.ToBase64String("abc|def"u8.ToArray()), out _));
    }
}
