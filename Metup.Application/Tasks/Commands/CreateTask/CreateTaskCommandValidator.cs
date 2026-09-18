using FluentValidation;
using Metup.Application.Common.Interfaces;

namespace Metup.Application.Tasks.Commands.CreateTask;

public class CreateTaskCommandValidator : AbstractValidator<CreateTaskCommand>
{
    public const int MaxNoteLength = 500;

    public CreateTaskCommandValidator(IOrganizationClock organizationClock)
    {
        RuleFor(x => x.DealId)
            .NotEmpty().WithMessage("Informe o negócio da tarefa.");

        RuleFor(x => x.Type)
            .IsInEnum().WithMessage("Tipo de tarefa inválido.");

        RuleFor(x => x.DueDate)
            .MustAsync(async (dueDate, cancellationToken) =>
                dueDate >= (await organizationClock.SnapshotAsync(cancellationToken)).UtcNow)
            .WithMessage("A tarefa não pode ser agendada no passado.");

        RuleFor(x => x.Note)
            .MaximumLength(MaxNoteLength).WithMessage($"A nota pode ter no máximo {MaxNoteLength} caracteres.");

        RuleFor(x => x.OwnerUserId)
            .NotEqual(Guid.Empty).WithMessage("Responsável inválido.");
    }
}
