using FluentValidation;
using Metup.Application.Common.Interfaces;

namespace Metup.Application.Tasks.Commands.BulkTask;

public class BulkTaskCommandValidator : AbstractValidator<BulkTaskCommand>
{
    public const int MaxIds = 100;

    public BulkTaskCommandValidator(IOrganizationClock organizationClock)
    {
        RuleFor(x => x.Ids)
            .NotEmpty().WithMessage("Selecione ao menos uma tarefa.")
            .Must(ids => ids is null || ids.Count <= MaxIds).WithMessage($"Selecione no máximo {MaxIds} tarefas por vez.");

        RuleForEach(x => x.Ids)
            .NotEmpty().WithMessage("Tarefa inválida.");

        RuleFor(x => x.Action)
            .IsInEnum().WithMessage("Ação inválida.");

        RuleFor(x => x.DueDate)
            .NotNull().WithMessage("Informe a nova data.")
            .When(x => x.Action == BulkTaskAction.Reschedule);

        RuleFor(x => x.DueDate)
            .MustAsync(async (dueDate, cancellationToken) =>
                dueDate >= (await organizationClock.SnapshotAsync(cancellationToken)).UtcNow)
            .WithMessage("A nova data não pode ser no passado.")
            .When(x => x.Action == BulkTaskAction.Reschedule && x.DueDate.HasValue);

        RuleFor(x => x.OwnerUserId)
            .NotNull().WithMessage("Informe o novo responsável.")
            .NotEqual(Guid.Empty).WithMessage("Responsável inválido.")
            .When(x => x.Action == BulkTaskAction.Reassign);
    }
}
