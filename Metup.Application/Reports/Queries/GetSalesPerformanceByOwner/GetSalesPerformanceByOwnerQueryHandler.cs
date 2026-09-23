using Metup.Application.Common.Interfaces;
using Metup.Application.Reports.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Reports.Queries.GetSalesPerformanceByOwner;

/// <summary>
/// Desempenho por responsável (V3, seção 7 do CLAUDE.md). O cálculo é o de
/// <see cref="SalesPerformanceReader"/> — aqui só se define o eixo (o dono do negócio) e o rótulo
/// (o nome do usuário).
/// </summary>
public class GetSalesPerformanceByOwnerQueryHandler(
    IApplicationDbContext context,
    ReportPeriodResolver periodResolver,
    SalesPerformanceReader reader) : IRequestHandler<GetSalesPerformanceByOwnerQuery, SalesPerformanceReportDto>
{
    private const string UnknownOwnerLabel = "—";

    public async Task<SalesPerformanceReportDto> Handle(GetSalesPerformanceByOwnerQuery request, CancellationToken cancellationToken)
    {
        var window = await periodResolver.ResolveAsync(request, cancellationToken);
        var rows = await reader.ReadAsync(window, cancellationToken);

        var ownerNames = await context.Users
            .AsNoTracking()
            .Where(u => u.OrganizationId == window.OrganizationId)
            .ToDictionaryAsync(u => u.Id, u => u.Name, cancellationToken);

        return SalesPerformanceReader.Build(
            window,
            rows,
            row => row.OwnerUserId.ToString(),
            row => ownerNames.GetValueOrDefault(row.OwnerUserId, UnknownOwnerLabel),
            group => group.GroupLabel);
    }
}
