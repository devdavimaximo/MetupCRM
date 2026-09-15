using Metup.Domain.Deals;

namespace Metup.Application.Deals.Analytics;

/// <summary>Uma passagem observada de um negócio por um estágio, lida de StageChange.</summary>
public readonly record struct StageReach(Guid DealId, DealStage ToStage, DateTime ChangedAt);

/// <summary>
/// Quantos negócios entraram no estágio, quantos seguiram adiante e em quanto tempo — a leitura
/// histórica do funil, sempre a partir de StageChange (nunca do Stage atual do Deal).
/// <see cref="AdvanceRate"/> e <see cref="AverageDaysInStage"/> ficam <c>null</c> sem amostra.
/// </summary>
public readonly record struct StageAdvanceStats(
    DealStage Stage,
    int EnteredCount,
    int AdvancedCount,
    decimal? AdvanceRate,
    double? AverageDaysInStage);

/// <summary>
/// Leitura estatística do funil a partir do histórico de estágios, compartilhada entre o relatório
/// de funil, o forecast e o dashboard — uma regra só, calculada num lugar só (seção 7 do CLAUDE.md).
/// Nenhum número é inventado: sem amostra, o resultado é <c>null</c>.
/// </summary>
public static class StageAnalytics
{
    /// <summary>
    /// Probabilidade histórica de um estágio virar Ganho: entre os negócios já fechados que em
    /// algum momento passaram pelo estágio, a fração que fechou como Ganho.
    /// </summary>
    public static IReadOnlyDictionary<DealStage, decimal?> CalculateWinProbabilities(
        IEnumerable<StageReach> reaches,
        IReadOnlyDictionary<Guid, DealStatus> closedDealStatusById) =>
        reaches
            .GroupBy(r => r.ToStage)
            .ToDictionary(
                g => g.Key,
                g =>
                {
                    var closedDealIds = g.Select(r => r.DealId).Distinct()
                        .Where(closedDealStatusById.ContainsKey)
                        .ToList();

                    if (closedDealIds.Count == 0)
                    {
                        return (decimal?)null;
                    }

                    var wonCount = closedDealIds.Count(id => closedDealStatusById[id] == DealStatus.Ganho);
                    return (decimal?)wonCount / closedDealIds.Count;
                });

    /// <summary>
    /// Para cada estágio ativo: quantos negócios entraram nele e quantos depois seguiram para uma
    /// etapa posterior ou para Ganho. Perdido não conta como avanço, e o negócio que ainda está
    /// parado no estágio entra na amostra como "não avançou" — é essa a pergunta do SDR.
    /// </summary>
    public static IReadOnlyList<StageAdvanceStats> CalculateAdvanceStats(IEnumerable<StageReach> reaches)
    {
        var byDeal = reaches
            .GroupBy(r => r.DealId)
            .ToDictionary(g => g.Key, g => g.OrderBy(r => r.ChangedAt).ToList());

        var durations = new Dictionary<DealStage, List<double>>();
        var entered = new Dictionary<DealStage, HashSet<Guid>>();
        var advanced = new Dictionary<DealStage, HashSet<Guid>>();

        foreach (var (dealId, ordered) in byDeal)
        {
            for (var i = 0; i < ordered.Count; i++)
            {
                var stage = ordered[i].ToStage;

                if (IsTerminal(stage))
                {
                    continue;
                }

                Bucket(entered, stage).Add(dealId);

                if (ordered.Skip(i + 1).Any(next => IsAdvanceFrom(stage, next.ToStage)))
                {
                    Bucket(advanced, stage).Add(dealId);
                }

                if (i + 1 < ordered.Count)
                {
                    if (!durations.TryGetValue(stage, out var days))
                    {
                        days = [];
                        durations[stage] = days;
                    }

                    days.Add((ordered[i + 1].ChangedAt - ordered[i].ChangedAt).TotalDays);
                }
            }
        }

        return entered
            .Select(kv =>
            {
                var enteredCount = kv.Value.Count;
                var advancedCount = advanced.GetValueOrDefault(kv.Key)?.Count ?? 0;
                var averageDays = durations.TryGetValue(kv.Key, out var days) && days.Count > 0
                    ? days.Average()
                    : (double?)null;

                return new StageAdvanceStats(
                    kv.Key,
                    enteredCount,
                    advancedCount,
                    enteredCount == 0 ? null : (decimal)advancedCount / enteredCount,
                    averageDays);
            })
            .OrderBy(s => s.Stage)
            .ToList();
    }

    /// <summary>Tempo médio, em dias, entre entrar num estágio e sair dele.</summary>
    public static IReadOnlyDictionary<DealStage, double> CalculateAverageDaysInStage(IEnumerable<StageReach> reaches) =>
        CalculateAdvanceStats(reaches)
            .Where(s => s.AverageDaysInStage.HasValue)
            .ToDictionary(s => s.Stage, s => s.AverageDaysInStage!.Value);

    private static bool IsAdvanceFrom(DealStage stage, DealStage next) =>
        next == DealStage.Ganho || (next != DealStage.Perdido && next > stage);

    private static bool IsTerminal(DealStage stage) => stage is DealStage.Ganho or DealStage.Perdido;

    private static HashSet<Guid> Bucket(Dictionary<DealStage, HashSet<Guid>> map, DealStage stage)
    {
        if (!map.TryGetValue(stage, out var set))
        {
            set = [];
            map[stage] = set;
        }

        return set;
    }
}
