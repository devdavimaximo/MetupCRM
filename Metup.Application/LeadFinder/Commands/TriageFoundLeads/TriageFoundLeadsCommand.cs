using FluentValidation;
using MediatR;

namespace Metup.Application.LeadFinder.Commands.TriageFoundLeads;

public enum TriageAction
{
    Discard,
    Restore,
}

/// <returns>Quantos leads mudaram de situação (os que já estavam nela são ignorados).</returns>
public record TriageFoundLeadsCommand(IReadOnlyList<Guid> Ids, TriageAction Action) : IRequest<int>;

public class TriageFoundLeadsCommandValidator : AbstractValidator<TriageFoundLeadsCommand>
{
    public const int MaxBatch = 500;

    public TriageFoundLeadsCommandValidator()
    {
        RuleFor(x => x.Ids)
            .NotEmpty().WithMessage("Selecione ao menos um lead.")
            .Must(ids => ids.Count <= MaxBatch).WithMessage($"Altere no máximo {MaxBatch} leads por vez.");

        RuleFor(x => x.Action).IsInEnum();
    }
}
