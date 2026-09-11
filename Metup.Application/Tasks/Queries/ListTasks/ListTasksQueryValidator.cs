using FluentValidation;

namespace Metup.Application.Tasks.Queries.ListTasks;

public class ListTasksQueryValidator : AbstractValidator<ListTasksQuery>
{
    public const int MaxPageSize = 200;

    public ListTasksQueryValidator()
    {
        RuleFor(x => x.Page)
            .GreaterThan(0).WithMessage("A página deve ser maior que zero.");

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, MaxPageSize)
            .WithMessage($"O tamanho da página deve estar entre 1 e {MaxPageSize}.");

        RuleFor(x => x.Status).IsInEnum().WithMessage("Status inválido.").When(x => x.Status.HasValue);
    }
}
