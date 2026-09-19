using FluentValidation;
using Metup.Domain.Deals;

namespace Metup.Application.Deals.Common;

/// <summary>
/// Filtros do pipeline, os mesmos para quadro, coluna, resumo e evolução. <see cref="OwnerUserId"/> e
/// <see cref="AllOwners"/> são <b>pedidos</b>: quem decide o que o usuário enxerga é
/// <c>ResolveDealOwnerScope</c>. <see cref="Segments"/> casa com <c>Company.Segment</c> exatamente;
/// <see cref="Search"/> procura no nome da empresa e do contato, sem acento nem caixa.
/// </summary>
public sealed record DealPipelineFilter(
    Guid? OwnerUserId = null,
    bool AllOwners = false,
    IReadOnlyList<DealSource>? Sources = null,
    IReadOnlyList<string>? Segments = null,
    string? Search = null);

/// <summary>Ordenação dentro da coluna do quadro. Sempre com desempate por <c>Id</c>.</summary>
public enum DealBoardSort
{
    /// <summary>Mais tempo na etapa primeiro — empurra o follow-up (princípio 3.5).</summary>
    Stalled,

    /// <summary>Maior valor primeiro; sem valor por último.</summary>
    ValueDesc,

    /// <summary>Criados mais recentemente primeiro.</summary>
    Recent,

    /// <summary>Previsão de fechamento mais próxima primeiro; sem previsão por último.</summary>
    ExpectedClose,
}

/// <summary>Sub-grupo da coluna Fechados.</summary>
public enum DealBoardClosedGroup
{
    Won,
    Lost,
}

public class DealPipelineFilterValidator : AbstractValidator<DealPipelineFilter>
{
    public const int MaxSearchLength = 100;
    public const int MaxListItems = 50;

    public DealPipelineFilterValidator()
    {
        RuleForEach(x => x.Sources).IsInEnum().WithMessage("Origem inválida.");

        RuleFor(x => x.Sources)
            .Must(s => s is null || s.Count <= MaxListItems)
            .WithMessage($"Informe no máximo {MaxListItems} origens.");

        RuleFor(x => x.Segments)
            .Must(s => s is null || s.Count <= MaxListItems)
            .WithMessage($"Informe no máximo {MaxListItems} segmentos.");

        RuleFor(x => x.Search)
            .MaximumLength(MaxSearchLength)
            .WithMessage($"A busca pode ter no máximo {MaxSearchLength} caracteres.");
    }
}
