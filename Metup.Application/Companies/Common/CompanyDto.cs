using Metup.Application.Contacts.Common;

namespace Metup.Application.Companies.Common;

/// <summary>Ficha completa da empresa, com os contatos associados.</summary>
public record CompanyDto(
    Guid Id,
    string Name,
    string? Segment,
    string? City,
    string? Instagram,
    string? Phone,
    IReadOnlyList<ContactDto> Contacts);

/// <summary>Linha da listagem/busca de empresas.</summary>
public record CompanyListItemDto(
    Guid Id,
    string Name,
    string? Segment,
    string? City,
    string? Phone,
    int ContactCount);
