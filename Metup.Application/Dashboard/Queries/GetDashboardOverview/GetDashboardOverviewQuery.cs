using FluentValidation;
using Metup.Application.Common.Interfaces;
using Metup.Application.Common.Models;
using Metup.Application.Dashboard.Common;
using MediatR;

namespace Metup.Application.Dashboard.Queries.GetDashboardOverview;

/// <summary>
/// Janela de <paramref name="Days"/> dias inteiros terminando hoje (no fuso da organização), ou o
/// intervalo local <paramref name="From"/>–<paramref name="To"/> (inclusive), que tem precedência
/// quando informado. A comparação é sempre a janela anterior de mesma quantidade de dias.
/// <paramref name="Scope"/> é um <b>pedido</b>: quem decide o que o usuário enxerga é <c>ResolveDealScope</c>.
/// </summary>
public record GetDashboardOverviewQuery(
    int Days = 30,
    DealScope Scope = DealScope.Organization,
    DateOnly? From = null,
    DateOnly? To = null) : IRequest<DashboardOverviewDto>;

public class GetDashboardOverviewQueryValidator : AbstractValidator<GetDashboardOverviewQuery>
{
    public const int MaxDays = LocalPeriod.MaxDays;

    public GetDashboardOverviewQueryValidator(IOrganizationClock organizationClock)
    {
        RuleFor(x => x.Days)
            .InclusiveBetween(1, MaxDays)
            .WithMessage($"O período deve ter entre 1 e {MaxDays} dias.");

        RuleFor(x => x.Scope)
            .IsInEnum()
            .WithMessage("Escopo inválido.");

        RuleFor(x => x)
            .Must(x => x.From.HasValue == x.To.HasValue)
            .WithName("Período")
            .WithMessage("Informe a data inicial e a final do período.");

        When(x => x.From.HasValue && x.To.HasValue, () =>
        {
            RuleFor(x => x)
                .Must(x => x.From <= x.To)
                .WithName("Período")
                .WithMessage("A data inicial deve ser anterior ou igual à final.");

            RuleFor(x => x)
                .Must(x => x.To!.Value.DayNumber - x.From!.Value.DayNumber + 1 <= MaxDays)
                .WithName("Período")
                .WithMessage($"O período pode ter no máximo {MaxDays} dias.");

            RuleFor(x => x.To)
                .MustAsync(async (to, cancellationToken) =>
                    to <= (await organizationClock.SnapshotAsync(cancellationToken)).Today)
                .WithMessage("A data final não pode estar no futuro.");
        });
    }
}
