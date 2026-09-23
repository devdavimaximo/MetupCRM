using Metup.Application.Reports.Common;
using MediatR;

namespace Metup.Application.Reports.Queries.GetSalesPerformanceBySource;

/// <summary>
/// Desempenho por origem do negócio (V3, seção 7 do CLAUDE.md). Mesmo cálculo de
/// <see cref="SalesPerformanceReader"/>; o eixo é <c>Deal.Source</c>. Chave e rótulo saem como o
/// nome do enum — a tradução para pt-br (seção 8) é da UI, que já mapeia DealSource no Pipeline.
/// </summary>
public class GetSalesPerformanceBySourceQueryHandler(
    ReportPeriodResolver periodResolver,
    SalesPerformanceReader reader) : IRequestHandler<GetSalesPerformanceBySourceQuery, SalesPerformanceReportDto>
{
    public async Task<SalesPerformanceReportDto> Handle(GetSalesPerformanceBySourceQuery request, CancellationToken cancellationToken)
    {
        var window = await periodResolver.ResolveAsync(request, cancellationToken);
        var rows = await reader.ReadAsync(window, cancellationToken);

        return SalesPerformanceReader.Build(
            window,
            rows,
            row => row.Source.ToString(),
            row => row.Source.ToString(),
            group => group.GroupKey);
    }
}
