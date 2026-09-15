using Metup.Domain.Deals;

namespace Metup.Application.Search.Common;

/// <summary>Empresa encontrada: o subtítulo na tela é segmento · cidade.</summary>
public record CompanySearchHitDto(Guid Id, string Name, string? Segment, string? City);

/// <summary>Contato encontrado, com a empresa dele (abrir o contato = abrir a ficha da empresa).</summary>
public record ContactSearchHitDto(Guid Id, string Name, Guid CompanyId, string CompanyName, string? Role);

/// <summary>Negócio encontrado pela empresa: etapa e valor efetivo (valor em negociação ou ticket).</summary>
public record DealSearchHitDto(Guid Id, Guid CompanyId, string CompanyName, DealStage Stage, DealStatus Status, decimal? Amount);

/// <summary>Até <see cref="Queries.GlobalSearch.SearchQuery.MaxHitsPerGroup"/> resultados de cada tipo.</summary>
public record SearchResultDto(
    IReadOnlyList<CompanySearchHitDto> Companies,
    IReadOnlyList<ContactSearchHitDto> Contacts,
    IReadOnlyList<DealSearchHitDto> Deals);
