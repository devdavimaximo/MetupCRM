using Metup.Domain.Deals;

namespace Metup.Application.Deals.Common;

/// <summary>Uma linha do histórico de estágios do negócio — de→para, com data e autor.</summary>
public record StageChangeDto(
    Guid Id,
    DealStage? FromStage,
    DealStage ToStage,
    DateTime ChangedAt,
    Guid ChangedByUserId);

/// <summary>
/// Ficha completa do negócio, com o histórico de transições de estágio. <c>LostReason</c>/<c>LostNote</c>
/// só existem em negócio perdido (nulos nos perdidos anteriores ao campo).
/// </summary>
public record DealDto(
    Guid Id,
    Guid CompanyId,
    string CompanyName,
    Guid? ContactId,
    string? ContactName,
    DealStage Stage,
    DealSource Source,
    Guid OwnerUserId,
    string OwnerUserName,
    decimal? Ticket,
    decimal? Amount,
    DateOnly? ExpectedCloseDate,
    DealStatus Status,
    DateTime CreatedAt,
    DateTime? ClosedAt,
    IReadOnlyList<StageChangeDto> StageHistory,
    LostReason? LostReason,
    string? LostNote);

/// <summary>Linha do pipeline (kanban) e da listagem/busca de negócios.</summary>
public record DealListItemDto(
    Guid Id,
    Guid CompanyId,
    string CompanyName,
    Guid? ContactId,
    string? ContactName,
    DealStage Stage,
    DealSource Source,
    Guid OwnerUserId,
    string OwnerUserName,
    decimal? Ticket,
    decimal? Amount,
    DateOnly? ExpectedCloseDate,
    DealStatus Status,
    DateTime CreatedAt,
    DateTime? ClosedAt);
