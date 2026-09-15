using FluentValidation;
using Metup.Application.Common.Models;
using Metup.Application.Dashboard.Common;
using MediatR;

namespace Metup.Application.Dashboard.Queries.GetDashboardOverview;

/// <summary>
/// Janela de <paramref name="Days"/> dias inteiros terminando hoje (no fuso da organização),
/// comparada à janela anterior de mesmo tamanho. <paramref name="Scope"/> é um <b>pedido</b>: quem
/// decide o que o usuário enxerga é <c>ResolveDealScope</c>.
/// </summary>
public record GetDashboardOverviewQuery(int Days = 30, DealScope Scope = DealScope.Organization)
    : IRequest<DashboardOverviewDto>;

public class GetDashboardOverviewQueryValidator : AbstractValidator<GetDashboardOverviewQuery>
{
    public const int MaxDays = 366;

    public GetDashboardOverviewQueryValidator()
    {
        RuleFor(x => x.Days)
            .InclusiveBetween(1, MaxDays)
            .WithMessage($"O período deve ter entre 1 e {MaxDays} dias.");

        RuleFor(x => x.Scope)
            .IsInEnum()
            .WithMessage("Escopo inválido.");
    }
}
