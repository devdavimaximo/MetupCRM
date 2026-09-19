using FluentValidation;
using Metup.Application.Common.Interfaces;
using Metup.Application.Common.Validation;
using Metup.Application.Deals.Common;
using MediatR;

namespace Metup.Application.Deals.Queries.GetDealBoard;

/// <param name="From">Início do período de Fechados (data local, inclusive). Sem período = últimos 30 dias.</param>
/// <param name="PerColumn">Amostra por coluna (padrão 20, máximo 50); o resto vem pela coluna paginada.</param>
public record GetDealBoardQuery(
    DealPipelineFilter Filter,
    DateOnly? From = null,
    DateOnly? To = null,
    DealBoardSort Sort = DealBoardSort.Stalled,
    int PerColumn = DealBoardReader.DefaultPerColumn) : IRequest<DealBoardDto>;

public class GetDealBoardQueryValidator : AbstractValidator<GetDealBoardQuery>
{
    public GetDealBoardQueryValidator(IOrganizationClock organizationClock)
    {
        RuleFor(x => x.Filter).NotNull().SetValidator(new DealPipelineFilterValidator());
        RuleFor(x => x.Sort).IsInEnum().WithMessage("Ordenação inválida.");
        RuleFor(x => x.PerColumn)
            .InclusiveBetween(1, DealBoardReader.MaxPerColumn)
            .WithMessage($"A amostra por coluna deve estar entre 1 e {DealBoardReader.MaxPerColumn}.");

        this.AddLocalPeriodRules(x => x.From, x => x.To, organizationClock);
    }
}
