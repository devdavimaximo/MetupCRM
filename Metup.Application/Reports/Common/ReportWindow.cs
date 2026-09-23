using FluentValidation;
using Metup.Application.Common.Interfaces;
using Metup.Application.Common.Models;
using Metup.Application.Common.Validation;
using Metup.Domain.Deals;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Reports.Common;

/// <summary>
/// O pedido de período de um relatório: os últimos <see cref="Days"/> dias terminando hoje, ou o
/// intervalo local <see cref="From"/>–<see cref="To"/> (inclusive), que tem precedência. Todas as
/// queries de relatório implementam este contrato para compartilharem resolução e validação.
/// </summary>
public interface IReportPeriodRequest
{
    /// <summary>
    /// Relatório é análise, não fotografia do dia: sem período pedido, a janela padrão é semestral —
    /// larga o bastante para as safras mensais e para a comparação com o semestre anterior fazerem
    /// sentido (o dashboard, que responde "como estamos hoje", usa 30 dias).
    /// </summary>
    public const int DefaultDays = 180;

    int Days { get; }

    DateOnly? From { get; }

    DateOnly? To { get; }
}

/// <summary>Regras de período comuns a todas as queries de relatório.</summary>
public static class ReportPeriodValidation
{
    public static void AddReportPeriodRules<T>(this AbstractValidator<T> validator, IOrganizationClock organizationClock)
        where T : IReportPeriodRequest
    {
        validator.RuleFor(x => x.Days)
            .InclusiveBetween(1, LocalPeriod.MaxDays)
            .WithMessage($"O período deve ter entre 1 e {LocalPeriod.MaxDays} dias.");

        validator.AddLocalPeriodRules(x => x.From, x => x.To, organizationClock);
    }
}

/// <summary>
/// A janela do relatório já resolvida em instantes UTC, com a organização do usuário atual e a
/// janela anterior de mesmo tamanho. <see cref="InPeriod"/> e <see cref="InPrevious"/> são os
/// únicos lugares que decidem em qual janela um instante cai — nenhum handler recorta na mão.
/// </summary>
public sealed record ReportWindow(
    Guid OrganizationId,
    DateTime PeriodStart,
    DateTime PeriodEnd,
    DateTime PreviousStart,
    OrganizationClockSnapshot Clock,
    ReportPeriodDto Period)
{
    public bool InPeriod(DateTime? at) => at >= PeriodStart && at <= PeriodEnd;

    public bool InPrevious(DateTime? at) => at >= PreviousStart && at < PeriodStart;
}

/// <summary>
/// Resolve a janela pedida em dias inteiros no fuso da organização (<see cref="IOrganizationClock"/>)
/// e descobre o início do histórico. É o ponto único de "que período este relatório está olhando":
/// os sete handlers dependem dele em vez de repetir o recorte.
/// </summary>
public class ReportPeriodResolver(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    IOrganizationClock organizationClock)
{
    public async Task<ReportWindow> ResolveAsync(IReportPeriodRequest request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();
        var clock = await organizationClock.SnapshotAsync(cancellationToken);

        var window = LocalPeriod.Resolve(request.From, request.To, clock.Today, request.Days);

        var periodStart = clock.StartOfDayUtc(window.StartLocal);
        var periodEnd = clock.EndOfDayUtc(window.EndLocal);
        var previousStart = clock.StartOfDayUtc(window.PreviousStartLocal);

        var historyStart = await context.Deals
            .AsNoTracking()
            .Where(d => d.OrganizationId == organizationId)
            .OrderBy(d => d.CreatedAt)
            .Select(d => (DateTime?)d.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        return new ReportWindow(
            organizationId,
            periodStart,
            periodEnd,
            previousStart,
            clock,
            new ReportPeriodDto(
                window.Days,
                periodStart,
                periodEnd,
                previousStart,
                window.StartLocal,
                window.EndLocal,
                historyStart));
    }

    /// <summary>
    /// Negócios da organização criados entre o início da janela anterior e o fim do período — a
    /// base comum dos relatórios que comparam com o período anterior.
    /// </summary>
    public IQueryable<Deal> DealsCreatedInWindow(ReportWindow window) =>
        context.Deals
            .AsNoTracking()
            .Where(d => d.OrganizationId == window.OrganizationId
                && d.CreatedAt >= window.PreviousStart
                && d.CreatedAt <= window.PeriodEnd);
}
