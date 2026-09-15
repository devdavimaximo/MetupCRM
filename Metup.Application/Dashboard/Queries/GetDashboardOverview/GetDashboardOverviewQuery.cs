using FluentValidation;
using Metup.Application.Dashboard.Common;
using MediatR;

namespace Metup.Application.Dashboard.Queries.GetDashboardOverview;

/// <summary>Janela móvel terminando agora, em dias — comparada à janela anterior de mesmo tamanho.</summary>
public record GetDashboardOverviewQuery(int Days = 30) : IRequest<DashboardOverviewDto>;

public class GetDashboardOverviewQueryValidator : AbstractValidator<GetDashboardOverviewQuery>
{
    public const int MaxDays = 366;

    public GetDashboardOverviewQueryValidator()
    {
        RuleFor(x => x.Days)
            .InclusiveBetween(1, MaxDays)
            .WithMessage($"O período deve ter entre 1 e {MaxDays} dias.");
    }
}
