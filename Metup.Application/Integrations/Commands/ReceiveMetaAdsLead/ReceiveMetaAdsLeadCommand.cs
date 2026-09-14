using Metup.Application.Deals.Common;
using MediatR;

namespace Metup.Application.Integrations.Commands.ReceiveMetaAdsLead;

/// <remarks>
/// Sem OrganizationId nem Source: o escopo vem do service token do n8n, e a origem é sempre
/// Meta Ads — este endpoint existe justamente para essa fonte (regra 4.4 do CLAUDE.md).
/// </remarks>
public record ReceiveMetaAdsLeadCommand(
    string ExternalLeadId,
    string CompanyName,
    string ContactName,
    string? Phone,
    string? Email,
    Guid OwnerUserId,
    decimal? Ticket,
    string? Note) : IRequest<DealDto>;
