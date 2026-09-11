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
    decimal? DealAmount);
