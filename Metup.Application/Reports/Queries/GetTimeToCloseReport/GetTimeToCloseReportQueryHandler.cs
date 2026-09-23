using Metup.Application.Reports.Common;
using MediatR;

namespace Metup.Application.Reports.Queries.GetTimeToCloseReport;

/// <summary>
/// Tempo ponta a ponta do funil (V3, seção 7 do CLAUDE.md) — da criação do negócio ao fechamento
/// como ganho, não por estágio (isso é do relatório de funil, via StageChange). O cálculo é o de
/// <see cref="TimeToCloseReader"/>: uma definição só, compartilhada com o funil.
/// </summary>
public class GetTimeToCloseReportQueryHandler(
    ReportPeriodResolver periodResolver,
    TimeToCloseReader reader) : IRequestHandler<GetTimeToCloseReportQuery, TimeToCloseReportDto>
{
    public async Task<TimeToCloseReportDto> Handle(GetTimeToCloseReportQuery request, CancellationToken cancellationToken)
    {
        var window = await periodResolver.ResolveAsync(request, cancellationToken);
        return new TimeToCloseReportDto(window.Period, await reader.ReadAsync(window, cancellationToken));
    }
}
