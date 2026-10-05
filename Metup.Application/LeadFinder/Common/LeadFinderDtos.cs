using Metup.Domain.LeadFinder;

namespace Metup.Application.LeadFinder.Common;

/// <param name="IsStalled">A automação não pegou (ou abandonou) a busca — a tela oferece reenviar ou cancelar.</param>
public record LeadSearchDto(
    Guid Id,
    string Query,
    string? Location,
    int? MaxResults,
    LeadSearchStatus Status,
    LeadSearchOrigin Origin,
    Guid? RequestedByUserId,
    string? RequestedByName,
    DateTime RequestedAt,
    DateTime? StartedAt,
    DateTime? FinishedAt,
    DateTime LastActivityAt,
    int ReceivedCount,
    int NewCount,
    string? ErrorMessage,
    bool IsStalled);

public record FoundLeadDto(
    Guid Id,
    Guid LeadSearchId,
    string Name,
    string? Category,
    string? Phone,
    string? Website,
    string? Email,
    string? Instagram,
    string? Address,
    string? City,
    string? State,
    decimal? Rating,
    int? ReviewCount,
    string? MapsUrl,
    FoundLeadStatus Status,
    Guid? ExistingCompanyId,
    Guid? CompanyId,
    Guid? DealId,
    DateTime FoundAt);

/// <summary>Quantos leads há em cada situação no recorte atual (busca + filtros), para as abas da tela.</summary>
public record FoundLeadStatusCounts(int New, int Imported, int Discarded);

public record FoundLeadPageDto(
    IReadOnlyList<FoundLeadDto> Items,
    int Page,
    int PageSize,
    int TotalCount,
    FoundLeadStatusCounts Counts)
{
    public int TotalPages => PageSize <= 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
}

/// <param name="Received">Leads no lote.</param>
/// <param name="Inserted">Inéditos na organização (viraram linha nova).</param>
/// <param name="Duplicates">Já estavam na base (de outra busca ou reenvio do mesmo lote).</param>
/// <param name="Rejected">Sem nome — não dá para prospectar. Ignorados sem derrubar o lote.</param>
/// <param name="Status">Situação da busca depois do lote — <c>Cancelled</c> diz ao n8n que pode parar.</param>
public record LeadBatchResultDto(int Received, int Inserted, int Duplicates, int Rejected, LeadSearchStatus Status);

public record LeadFinderSettingsDto(string? WebhookUrl, bool ServiceTokenConfigured);
