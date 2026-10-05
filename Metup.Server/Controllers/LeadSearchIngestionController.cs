using Metup.Application.Integrations.Commands.FinishLeadSearch;
using Metup.Application.Integrations.Commands.ReceiveLeadSearchResults;
using Metup.Application.Integrations.Commands.StartAutomationLeadSearch;
using Metup.Application.LeadFinder.Common;
using Metup.Application.LeadFinder.Queries.ListLeadSearches;
using Metup.Server.Security;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Metup.Server.Controllers;

/// <remarks>
/// Ingestão do buscador de leads (n8n → CRM), autenticada pelo service token da organização. Tudo
/// idempotente: o n8n pode reenviar qualquer chamada. Contrato em
/// <c>docs/planning/n8n-buscador-de-leads.md</c>.
/// </remarks>
[ApiController]
[Authorize(AuthenticationSchemes = ServiceTokenAuthenticationHandler.SchemeName)]
[Route("api/integrations/lead-searches")]
public class LeadSearchIngestionController(ISender sender) : ControllerBase
{
    /// <summary>Busca disparada fora do CRM (chat do agente): registra e devolve o id para os próximos envios.</summary>
    [HttpPost]
    public async Task<ActionResult<LeadSearchDto>> Start(
        StartAutomationLeadSearchCommand command,
        CancellationToken cancellationToken) =>
        Ok(await sender.Send(command, cancellationToken));

    /// <summary>O n8n confere o pedido (e se não foi cancelado) antes de gastar créditos garimpando.</summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<LeadSearchDto>> Get(Guid id, CancellationToken cancellationToken) =>
        Ok(await sender.Send(new GetLeadSearchQuery(id), cancellationToken));

    [HttpPost("{id:guid}/results")]
    public async Task<ActionResult<LeadBatchResultDto>> ReceiveResults(
        Guid id,
        ReceiveLeadSearchResultsRequest request,
        CancellationToken cancellationToken) =>
        Ok(await sender.Send(new ReceiveLeadSearchResultsCommand(id, request.Leads ?? []), cancellationToken));

    [HttpPost("{id:guid}/complete")]
    public async Task<ActionResult<LeadSearchDto>> Complete(
        Guid id,
        FinishLeadSearchRequest request,
        CancellationToken cancellationToken) =>
        Ok(await sender.Send(new FinishLeadSearchCommand(id, request.Success ?? true, request.ErrorMessage), cancellationToken));
}

public record ReceiveLeadSearchResultsRequest(IReadOnlyList<IncomingLead>? Leads);

/// <param name="Success">Omitido = sucesso.</param>
public record FinishLeadSearchRequest(bool? Success, string? ErrorMessage);
