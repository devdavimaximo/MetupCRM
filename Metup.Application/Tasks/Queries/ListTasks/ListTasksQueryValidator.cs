using FluentValidation;

namespace Metup.Application.Tasks.Queries.ListTasks;

public class ListTasksQueryValidator : AbstractValidator<ListTasksQuery>
{
    public const int MaxPageSize = 100;

    /// <summary>
    /// Limite do modo legado (sem <c>Scope</c>): a TasksPage atual pede 200 de uma vez. Sai quando a
    /// onda T2 trocar a tela pela listagem paginada.
    /// </summary>
    public const int LegacyMaxPageSize = 200;

    public const int MaxSearchLength = 100;

    public ListTasksQueryValidator()
    {
        RuleFor(x => x.Page)
            .GreaterThan(0).WithMessage("A página deve ser maior que zero.");

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, MaxPageSize)
            .When(x => x.Scope.HasValue)
            .WithMessage($"O tamanho da página deve estar entre 1 e {MaxPageSize}.");

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, LegacyMaxPageSize)
            .When(x => !x.Scope.HasValue)
            .WithMessage($"O tamanho da página deve estar entre 1 e {LegacyMaxPageSize}.");

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
