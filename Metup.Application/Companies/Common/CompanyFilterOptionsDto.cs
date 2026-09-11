namespace Metup.Application.Companies.Common;

/// <summary>Segmentos e cidades distintos já cadastrados na organização, para popular os seletores de filtro.</summary>
public record CompanyFilterOptionsDto(IReadOnlyList<string> Segments, IReadOnlyList<string> Cities);
