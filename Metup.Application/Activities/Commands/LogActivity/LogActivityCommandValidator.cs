using Metup.Domain.Activities;
using FluentValidation;

namespace Metup.Application.Activities.Commands.LogActivity;

public class LogActivityCommandValidator : AbstractValidator<LogActivityCommand>
{
    public const int MaxNoteLength = 500;

    public LogActivityCommandValidator()
    {
        RuleFor(x => x.DealId)
            .NotEmpty().WithMessage("Informe o negócio da atividade.");

        RuleFor(x => x.Type)
            .IsInEnum().WithMessage("Tipo de atividade inválido.");

        RuleFor(x => x.Outcome)
            .IsInEnum().WithMessage("Desfecho inválido.")
            .When(x => x.Outcome.HasValue);

        RuleFor(x => x.Outcome)
            .NotNull().WithMessage("Toda ligação precisa de um desfecho estruturado.")
            .When(x => x.Type == ActivityType.Call);

        RuleFor(x => x.Note)
            .MaximumLength(MaxNoteLength).WithMessage($"A nota pode ter no máximo {MaxNoteLength} caracteres.");

        RuleFor(x => x.NextActionType)
            .IsInEnum().WithMessage("Tipo da próxima ação inválido.")
            .When(x => x.NextActionType.HasValue);

        RuleFor(x => x.NextActionType)
            .NotNull().WithMessage("Informe o tipo da próxima ação.")
            .When(x => x.NextActionDueDate.HasValue);

        RuleFor(x => x.NextActionDueDate)
            .NotNull().WithMessage("Informe a data da próxima ação.")
            .When(x => x.NextActionType.HasValue);

        RuleFor(x => x.NextActionDueDate)
            .GreaterThanOrEqualTo(DateTime.UtcNow).WithMessage("A próxima ação não pode ser agendada no passado.")
            .When(x => x.NextActionDueDate.HasValue);

        RuleFor(x => x.NextActionNote)
            .MaximumLength(MaxNoteLength).WithMessage($"A nota da próxima ação pode ter no máximo {MaxNoteLength} caracteres.");
    }
}
