using Metup.Domain.Activities;
using Metup.Domain.Deals;

namespace Metup.Application.Dialer.Common;

/// <param name="TotalCount">Ligações pendentes até o fim de hoje, antes do limite e de juntar por negócio.</param>
public record DialerQueueDto(
    IReadOnlyList<DialerQueueItemDto> Items,
    int TotalCount,
    DateOnly ReferenceDate,
    DateTime GeneratedAt);

/// <summary>
/// Um negócio a ligar: a tarefa de ligação que o trouxe (concluída ao registrar), os números em ordem
/// de preferência e o contexto que o SDR lê enquanto chama — sem abrir a ficha.
/// </summary>
public record DialerQueueItemDto(
    Guid TaskId,
    DateTime DueDate,
    bool IsOverdue,
    string? TaskNote,
    Guid DealId,
    DealStage Stage,
    DealSource Source,
    Guid CompanyId,
    string CompanyName,
    string? Segment,
    string? City,
    string? Website,
    string? Instagram,
    Guid? ContactId,
    string? ContactName,
    string? ContactRole,
    IReadOnlyList<DialerPhoneDto> Phones,
    DialerCallHistoryDto CallHistory,
    DialerLeadDto? Lead);

public enum DialerPhoneKind
{
    Contact,
    ContactWhatsApp,
    Company,
}

/// <param name="Display">Como está cadastrado.</param>
/// <param name="Dial">O que vai no <c>tel:</c> (E.164 ou número de serviço). Nulo = não discável (sem DDD, curto…).</param>
public record DialerPhoneDto(DialerPhoneKind Kind, string Display, string? Dial);

/// <summary>Tentativas anteriores de ligação neste negócio, de qualquer autor.</summary>
public record DialerCallHistoryDto(int Attempts, ActivityOutcome? LastOutcome, DateTime? LastCallAt);

/// <summary>O que o buscador de leads trouxe sobre a empresa (nulo se o negócio não veio de lá).</summary>
public record DialerLeadDto(
    Guid LeadSearchId,
    string SearchQuery,
    string? SearchLocation,
    string? Category,
    decimal? Rating,
    int? ReviewCount,
    string? Address,
    string? MapsUrl);
