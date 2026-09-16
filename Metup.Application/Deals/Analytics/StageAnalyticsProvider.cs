using Metup.Application.Common.Interfaces;
using Metup.Application.Common.Models;
using Metup.Domain.Deals;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Metup.Application.Deals.Analytics;

/// <summary>
/// Tudo que se lê do histórico de estágios de um escopo, de uma vez: a taxa de avanço por etapa, a
/// probabilidade histórica de ganho por etapa e a última transição de cada negócio.
/// </summary>
/// <param name="LastStageChangeByDeal">
/// Negócio sem transição nenhuma não aparece aqui — quem pergunta cai no <c>CreatedAt</c> dele.
/// </param>
public sealed record StageAnalyticsSnapshot(
    IReadOnlyList<StageAdvanceStats> AdvanceStats,
    IReadOnlyDictionary<DealStage, decimal?> WinProbabilityByStage,
    IReadOnlyDictionary<Guid, DateTime> LastStageChangeByDeal);

public interface IStageAnalyticsProvider
{
    Task<StageAnalyticsSnapshot> GetAsync(DealScopeFilter scope, CancellationToken cancellationToken);
}

/// <summary>
/// Lê o histórico de estágios do escopo e calcula as três leituras. É a parte cara do dashboard:
/// medida na onda 3B, com 50 mil negócios e 150 mil transições, custa ~156ms de leitura mais ~217ms
/// de CPU — mais da metade do tempo do panorama. Por isso existe o
/// <see cref="CachedStageAnalyticsProvider"/> por cima.
/// </summary>
public class StageAnalyticsProvider(IApplicationDbContext context) : IStageAnalyticsProvider
{
    public async Task<StageAnalyticsSnapshot> GetAsync(DealScopeFilter scope, CancellationToken cancellationToken)
    {
        var scopedDeals = context.Deals.AsNoTracking().Where(d => d.OrganizationId == scope.OrganizationId);
        if (scope.OwnerUserId is { } ownerUserId)
        {
            scopedDeals = scopedDeals.Where(d => d.OwnerUserId == ownerUserId);
        }

        // O escopo das transições vem do negócio a que pertencem, nunca de quem as registrou.
        var scopedStageChanges = context.StageChanges
            .AsNoTracking()
            .Where(sc => sc.OrganizationId == scope.OrganizationId);

        if (scope.OwnerUserId is not null)
        {
            var scopedDealIds = scopedDeals.Select(d => d.Id);
            scopedStageChanges = scopedStageChanges.Where(sc => scopedDealIds.Contains(sc.DealId));
        }

        var reaches = await scopedStageChanges
            .Select(sc => new StageReach(sc.DealId, sc.ToStage, sc.ChangedAt))
            .ToListAsync(cancellationToken);

        var closedDealStatusById = await scopedDeals
            .Where(d => d.Status != DealStatus.Aberto)
            .Select(d => new { d.Id, d.Status })
            .ToDictionaryAsync(d => d.Id, d => d.Status, cancellationToken);

        return new StageAnalyticsSnapshot(
            StageAnalytics.CalculateAdvanceStats(reaches),
            StageAnalytics.CalculateWinProbabilities(reaches, closedDealStatusById),
            reaches.GroupBy(r => r.DealId).ToDictionary(g => g.Key, g => g.Max(r => r.ChangedAt)));
    }
}

/// <summary>
/// Guarda a leitura do histórico por escopo durante <see cref="Ttl"/>.
///
/// Por que é aceitável ficar desatualizado: os três números são <b>agregados históricos</b>, não a
/// fotografia do funil. A contagem e o valor de cada etapa continuam vindo do banco a cada
/// carregamento — o que envelhece aqui é a taxa de avanço, a probabilidade de ganho e "há quantos
/// dias o negócio está na etapa". As duas primeiras se movem em fração de ponto quando um negócio
/// anda; a terceira é medida em <b>dias</b>, então alguns minutos de atraso não mudam nem o número
/// exibido nem quem conta como parado.
///
/// Alternativa descartada na onda 3B: tabela de leitura com job do Hangfire. Resolve o mesmo
/// problema, mas custa entidade, migration, job e caminho de recálculo — e só se paga com mais de
/// uma instância, que o projeto ainda não tem.
/// </summary>
public class CachedStageAnalyticsProvider(IStageAnalyticsProvider inner, IMemoryCache cache) : IStageAnalyticsProvider
{
    public static readonly TimeSpan Ttl = TimeSpan.FromMinutes(15);

    public Task<StageAnalyticsSnapshot> GetAsync(DealScopeFilter scope, CancellationToken cancellationToken) =>
        // A chave carrega o responsável: a carteira de um SDR tem histórico diferente do da organização.
        cache.GetOrCreateAsync(
            (nameof(StageAnalyticsSnapshot), scope.OrganizationId, scope.OwnerUserId),
            entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = Ttl;
                return inner.GetAsync(scope, cancellationToken);
            })!;
}
