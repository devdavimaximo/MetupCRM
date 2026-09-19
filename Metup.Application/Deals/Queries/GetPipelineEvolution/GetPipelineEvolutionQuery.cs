using FluentValidation;
using Metup.Application.Deals.Common;
using MediatR;

namespace Metup.Application.Deals.Queries.GetPipelineEvolution;

/// <param name="Months">Quantos meses, contando o corrente: 3, 6 ou 12.</param>
public record GetPipelineEvolutionQuery(DealPipelineFilter Filter, int Months = 6) : IRequest<PipelineEvolutionDto>;

public class GetPipelineEvolutionQueryValidator : AbstractValidator<GetPipelineEvolutionQuery>
{
    public static readonly int[] AllowedMonths = [3, 6, 12];

    public GetPipelineEvolutionQueryValidator()
    {
        RuleFor(x => x.Filter).NotNull().SetValidator(new DealPipelineFilterValidator());
        RuleFor(x => x.Months)
            .Must(m => AllowedMonths.Contains(m))
            .WithMessage("Informe 3, 6 ou 12 meses.");
    }
}
