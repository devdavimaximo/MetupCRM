using FluentValidation;

namespace Metup.Application.Tasks.Queries.ListTasks;

public class ListTasksQueryValidator : AbstractValidator<ListTasksQuery>
{
    /// <summary>Vale com e sem <c>Scope</c>: o limite de 200 do modo legado saiu com a T2.</summary>
    public const int MaxPageSize = 100;

    public const int MaxSearchLength = 100;

    public ListTasksQueryValidator()
    {
        RuleFor(x => x.Page)
            .GreaterThan(0).WithMessage("A página deve ser maior que zero.");

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, MaxPageSize)
            .WithMessage($"O tamanho da página deve estar entre 1 e {MaxPageSize}.");

        RuleFor(x => x.Status).IsInEnum().WithMessage("Status inválido.").When(x => x.Status.HasValue);

        RuleFor(x => x.Scope).IsInEnum().WithMessage("Recorte inválido.").When(x => x.Scope.HasValue);

        RuleFor(x => x.Sort).IsInEnum().WithMessage("Ordenação inválida.");

        RuleForEach(x => x.Statuses).IsInEnum().WithMessage("Status inválido.");

        RuleForEach(x => x.Types).IsInEnum().WithMessage("Tipo de tarefa inválido.");

        RuleForEach(x => x.DealStages).IsInEnum().WithMessage("Etapa inválida.");

        RuleFor(x => x.Search)
            .MaximumLength(MaxSearchLength).WithMessage($"A busca pode ter no máximo {MaxSearchLength} caracteres.");
    }
}
