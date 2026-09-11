using FluentValidation;

namespace Metup.Application.Tasks.Commands.CreateTask;

public class CreateTaskCommandValidator : AbstractValidator<CreateTaskCommand>
{
    public const int MaxNoteLength = 500;

    public CreateTaskCommandValidator()
    {
        RuleFor(x => x.DealId)
            .NotEmpty().WithMessage("Informe o negócio da tarefa.");

        RuleFor(x => x.Type)
            .IsInEnum().WithMessage("Tipo de tarefa inválido.");

        RuleFor(x => x.DueDate)
            .GreaterThanOrEqualTo(DateTime.UtcNow).WithMessage("A tarefa não pode ser agendada no passado.");

        RuleFor(x => x.Note)
            .MaximumLength(MaxNoteLength).WithMessage($"A nota pode ter no máximo {MaxNoteLength} caracteres.");
    }
}
