using Metup.Application.Reports.Common;
using MediatR;

namespace Metup.Application.Reports.Queries.GetSalesPerformanceBySegment;

/// <summary>
/// Desempenho por segmento de empresa (V3, seção 7 do CLAUDE.md). Mesmo cálculo de
/// <see cref="SalesPerformanceReader"/>; o eixo é <c>Company.Segment</c>, e a empresa sem segmento
/// vira um grupo próprio em vez de sumir do relatório.
/// </summary>
public class GetSalesPerformanceBySegmentQueryHandler(
    ReportPeriodResolver periodResolver,
    SalesPerformanceReader reader) : IRequestHandler<GetSalesPerformanceBySegmentQuery, SalesPerformanceReportDto>
{
    private const string NoSegmentLabel = "Sem segmento";

    public async Task<SalesPerformanceReportDto> Handle(GetSalesPerformanceBySegmentQuery request, CancellationToken cancellationToken)
    {
        var window = await periodResolver.ResolveAsync(request, cancellationToken);
        var rows = await reader.ReadAsync(window, cancellationToken);

        return SalesPerformanceReader.Build(
            window,
            rows,
            row => row.Segment ?? string.Empty,
            row => string.IsNullOrWhiteSpace(row.Segment) ? NoSegmentLabel : row.Segment,
            group => group.GroupLabel);
    }
}
