using FluentValidation;

namespace Metup.Application.LeadFinder.Commands.ImportFoundLeads;

public class ImportFoundLeadsCommandValidator : AbstractValidator<ImportFoundLeadsCommand>
{
    public const int MaxBatch = 200;

    public ImportFoundLeadsCommandValidator()
    {
        RuleFor(x => x.Ids)
            .NotEmpty().WithMessage("Selecione ao menos um lead.")
            .Must(ids => ids.Count <= MaxBatch).WithMessage($"Importe no máximo {MaxBatch} leads por vez.");
    }
}
