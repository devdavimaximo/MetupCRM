using Metup.Application.Common.Models;
using Metup.Application.Deals.Commands.ChangeDealStage;
using Metup.Application.Deals.Commands.CloseDeal;
using Metup.Application.Deals.Commands.CreateDeal;
using Metup.Application.Deals.Commands.UpdateDeal;
using Metup.Application.Deals.Common;
using Metup.Application.Deals.Queries.GetDealById;
using Metup.Application.Deals.Queries.ListDeals;
using Metup.Domain.Deals;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Metup.Server.Controllers;

/// <remarks>
/// Regra de acesso atual: todo usuário autenticado opera os negócios da própria organização.
/// O escopo por organização é resolvido no handler (ICurrentUserService), nunca pelo client.
/// </remarks>
[ApiController]
[Authorize]
[Route("api/deals")]
public class DealsController(ISender sender) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<DealDto>> Create(CreateDealCommand command, CancellationToken cancellationToken)
    {
        var deal = await sender.Send(command, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = deal.Id }, deal);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<DealDto>> Update(
        Guid id,
        UpdateDealRequest request,
        CancellationToken cancellationToken)
    {
        var command = new UpdateDealCommand(
            id,
            request.ContactId,
            request.Source,
            request.OwnerUserId,
            request.Ticket,
            request.Amount,
            request.ExpectedCloseDate);

        return Ok(await sender.Send(command, cancellationToken));
    }

    [HttpPost("{id:guid}/stage")]
    public async Task<ActionResult<DealDto>> ChangeStage(
        Guid id,
        ChangeDealStageRequest request,
        CancellationToken cancellationToken) =>
        Ok(await sender.Send(new ChangeDealStageCommand(id, request.Stage), cancellationToken));

    [HttpPost("{id:guid}/close")]
    public async Task<ActionResult<DealDto>> Close(
        Guid id,
        CloseDealRequest request,
        CancellationToken cancellationToken) =>
        Ok(await sender.Send(new CloseDealCommand(id, request.Won, request.ClosedAmount), cancellationToken));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<DealDto>> GetById(Guid id, CancellationToken cancellationToken) =>
        Ok(await sender.Send(new GetDealByIdQuery(id), cancellationToken));

    [HttpGet]
    public async Task<ActionResult<PagedResult<DealListItemDto>>> List(
        [FromQuery] DealStage? stage,
        [FromQuery] Guid? ownerUserId,
        [FromQuery] DealSource? source,
        [FromQuery] Guid? companyId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var query = new ListDealsQuery(stage, ownerUserId, source, companyId, page, pageSize);
        return Ok(await sender.Send(query, cancellationToken));
    }
}

public record UpdateDealRequest(
    Guid? ContactId,
    DealSource Source,
    Guid OwnerUserId,
    decimal? Ticket,
    decimal? Amount,
    DateOnly? ExpectedCloseDate = null);

public record ChangeDealStageRequest(DealStage Stage);

public record CloseDealRequest(bool Won, decimal? ClosedAmount);
