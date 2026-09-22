using Metup.Domain.Conversations;
using Metup.Domain.Deals;

namespace Metup.Application.Conversations.Common;

/// <summary>Alimenta o painel de contexto ao lado da conversa: quem é, de qual empresa e onde está no funil.</summary>
public record ConversationContextDto(
    Guid ContactId,
    string ContactName,
    string? ContactRole,
    string? ContactPhone,
    string? ContactWhatsApp,
    string? ContactEmail,
    Guid CompanyId,
    string CompanyName,
    Guid? DealId,
    DealStage? DealStage,
    DealStatus? DealStatus,
    decimal? DealTicket,
    decimal? DealAmount,
    ConversationChannel Channel,
    ConversationStatus Status,
    bool AutomationEnabled,
    IReadOnlyList<string> Tags,
    string? CompanyCnpj,
    string? CompanyWebsite,
    string? CompanySegment,
    string? CompanyCity,
    string? DealOwnerUserName,
    ConversationSummaryDto Summary);

/// <summary>
/// Diagnóstico rápido da thread. <see cref="AverageResponseTimeMinutes"/> é a média do tempo entre
/// cada mensagem inbound e a primeira outbound que vem depois dela na mesma conversa — pares sem
/// outbound seguinte não entram na média; <c>null</c> sem nenhum par ainda. Calculado sob demanda,
/// não é campo persistido.
/// </summary>
public record ConversationSummaryDto(
    int TotalMessages,
    double? AverageResponseTimeMinutes,
    DateTime? LastInteractionAt);
