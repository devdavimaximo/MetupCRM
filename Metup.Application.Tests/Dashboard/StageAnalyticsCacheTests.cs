using Metup.Application.Common.Models;
using Metup.Application.Deals.Analytics;
using Metup.Domain.Deals;
using Microsoft.Extensions.Caching.Memory;
using Xunit;

namespace Metup.Application.Tests.Dashboard;

/// <summary>Provider de mentira que conta quantas vezes foi consultado e por qual escopo.</summary>
internal sealed class CountingProvider : IStageAnalyticsProvider
{
    public List<DealScopeFilter> Calls { get; } = [];

    public Task<StageAnalyticsSnapshot> GetAsync(DealScopeFilter scope, CancellationToken cancellationToken)
    {
        Calls.Add(scope);
        return Task.FromResult(new StageAnalyticsSnapshot(
            [new StageAdvanceStats(DealStage.Prospect, Calls.Count, 0, null, null)],
            new Dictionary<DealStage, decimal?>(),
            new Dictionary<Guid, DateTime>()));
    }
}

public class StageAnalyticsCacheTests
{
    private static readonly Guid OrganizationId = Guid.NewGuid();

    private static (CachedStageAnalyticsProvider Cached, CountingProvider Inner, MemoryCache Cache) Build()
    {
        var inner = new CountingProvider();
        var cache = new MemoryCache(new MemoryCacheOptions());
        return (new CachedStageAnalyticsProvider(inner, cache), inner, cache);
    }

    [Fact]
    public async Task Segunda_leitura_do_mesmo_escopo_nao_recalcula()
    {
        var (cached, inner, cache) = Build();
        using var _ = cache;
        var scope = new DealScopeFilter(OrganizationId, null, DealScope.Organization);

        var first = await cached.GetAsync(scope, TestContext.Current.CancellationToken);
        var second = await cached.GetAsync(scope, TestContext.Current.CancellationToken);

        Assert.Single(inner.Calls);
        // Não é só "não chamou de novo": é a mesma leitura devolvida, sem recomputar nada.
        Assert.Same(first, second);
    }

    [Fact]
    public async Task Carteira_do_SDR_e_organizacao_sao_entradas_diferentes()
    {
        var (cached, inner, cache) = Build();
        using var _ = cache;
        var sdrUserId = Guid.NewGuid();

        var organization = await cached.GetAsync(
            new DealScopeFilter(OrganizationId, null, DealScope.Organization), TestContext.Current.CancellationToken);
        var mine = await cached.GetAsync(
            new DealScopeFilter(OrganizationId, sdrUserId, DealScope.Mine), TestContext.Current.CancellationToken);

        // O histórico da carteira de um SDR não é o da organização: misturar as duas leituras
        // mostraria a taxa de avanço alheia para ele.
        Assert.Equal(2, inner.Calls.Count);
        Assert.NotSame(organization, mine);
        Assert.Contains(inner.Calls, c => c.OwnerUserId is null);
        Assert.Contains(inner.Calls, c => c.OwnerUserId == sdrUserId);
    }

    [Fact]
    public async Task Organizacoes_diferentes_nao_compartilham_a_leitura()
    {
        var (cached, inner, cache) = Build();
        using var _ = cache;

        await cached.GetAsync(new DealScopeFilter(OrganizationId, null, DealScope.Organization), TestContext.Current.CancellationToken);
        await cached.GetAsync(new DealScopeFilter(Guid.NewGuid(), null, DealScope.Organization), TestContext.Current.CancellationToken);

        Assert.Equal(2, inner.Calls.Count);
    }

    [Fact]
    public async Task Provider_sem_cache_calcula_a_partir_do_historico_de_estagios()
    {
        using var context = new DashboardOverviewTestContext();
        var now = new DateTime(2026, 9, 15, 17, 0, 0, DateTimeKind.Utc);

        // Um avançou de Prospect para Qualificação; o outro ficou em Prospect.
        context.AddOpenDeal(context.AdminUserId, 1_000m, null, now.AddDays(-10), stage: DealStage.Qualificacao);
        var parado = context.AddOpenDeal(context.AdminUserId, 2_000m, null, now.AddDays(-10));

        var snapshot = await new StageAnalyticsProvider(context.Db).GetAsync(
            new DealScopeFilter(context.OrganizationId, null, DealScope.Organization),
            TestContext.Current.CancellationToken);

        var prospect = Assert.Single(snapshot.AdvanceStats, s => s.Stage == DealStage.Prospect);
        Assert.Equal(2, prospect.EnteredCount);
        Assert.Equal(1, prospect.AdvancedCount);
        Assert.Equal(0.5m, prospect.AdvanceRate);

        // A última transição do negócio parado é a entrada no funil, no instante em que foi criado.
        Assert.Equal(now.AddDays(-10), snapshot.LastStageChangeByDeal[parado.Id]);
    }

    [Fact]
    public async Task Provider_sem_cache_respeita_o_escopo_do_responsavel()
    {
        using var context = new DashboardOverviewTestContext();
        var now = new DateTime(2026, 9, 15, 17, 0, 0, DateTimeKind.Utc);

        context.AddOpenDeal(context.AdminUserId, 1_000m, null, now.AddDays(-10), stage: DealStage.Qualificacao);
        var doSdr = context.AddOpenDeal(context.SdrUserId, 2_000m, null, now.AddDays(-10));

        var snapshot = await new StageAnalyticsProvider(context.Db).GetAsync(
            new DealScopeFilter(context.OrganizationId, context.SdrUserId, DealScope.Mine),
            TestContext.Current.CancellationToken);

        // Só o negócio do SDR entra: o do Admin não aparece nem no histórico nem na última transição.
        Assert.Equal([doSdr.Id], snapshot.LastStageChangeByDeal.Keys);
        var prospect = Assert.Single(snapshot.AdvanceStats, s => s.Stage == DealStage.Prospect);
        Assert.Equal(1, prospect.EnteredCount);
        Assert.Equal(0, prospect.AdvancedCount);
    }
}
