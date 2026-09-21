using FluentValidation;
using Metup.Application.Common.Interfaces;
using Metup.Application.Common.Validation;
using Metup.Application.Deals.Common;
using Metup.Domain.Deals;
using MediatR;

namespace Metup.Application.Deals.Queries.GetDealBoardColumn;

/// <summary>
/// "Carregar mais" de uma coluna: uma etapa ativa (<paramref name="Stage"/>) ou um sub-grupo de
/// Fechados (<paramref name="Closed"/>) — exatamente um dos dois — com os mesmos filtros do quadro.
/// </summary>
public record GetDealBoardColumnQuery(
    DealPipelineFilter Filter,
    DealStage? Stage = null,
    DealBoardClosedGroup? Closed = null,
    DateOnly? From = null,
    DateOnly? To = null,
    DealBoardSort Sort = DealBoardSort.Stalled,
    int Page = 1,
    int PerColumn = DealBoardReader.DefaultPerColumn) : IRequest<DealBoardColumnDto>;

public class GetDealBoardColumnQueryValidator : AbstractValidator<GetDealBoardColumnQuery>
{
    public GetDealBoardColumnQueryValidator(IOrganizationClock organizationClock)
    {
        RuleFor(x => x.Filter).NotNull().SetValidator(new DealPipelineFilterValidator());

        RuleFor(x => x)
            .Must(x => x.Stage.HasValue != x.Closed.HasValue)
            .WithName("Coluna")
            .WithMessage("Informe a etapa ou o grupo de fechados (ganhos ou perdidos), não os dois.");

        RuleFor(x => x.Stage)
            .Must(stage => stage is { } value && DealBoardReader.ActiveStages.Contains(value))
            .When(x => x.Stage.HasValue)
            .WithMessage("Etapa inválida para o quadro. Para ganhos e perdidos, use o grupo de fechados.");

        RuleFor(x => x.Closed).IsInEnum().When(x => x.Closed.HasValue).WithMessage("Grupo de fechados inválido.");
        RuleFor(x => x.Sort).IsInEnum().WithMessage("Ordenação inválida.");
        RuleFor(x => x.Page).GreaterThan(0).WithMessage("A página deve ser maior que zero.");
        RuleFor(x => x.PerColumn)
            .InclusiveBetween(1, DealBoardReader.MaxColumnPageSize)
            .WithMessage($"A página da coluna deve estar entre 1 e {DealBoardReader.MaxColumnPageSize}.");

        this.AddLocalPeriodRules(x => x.From, x => x.To, organizationClock);
    }
}
