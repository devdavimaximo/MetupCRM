using Metup.Application.Common.Models;
using Metup.Application.Deals.Commands.ChangeDealStage;
using Metup.Application.Deals.Commands.CloseDeal;
using Metup.Application.Deals.Commands.CreateDeal;
using Metup.Application.Deals.Commands.UpdateDeal;
using Metup.Application.Deals.Common;
using Metup.Application.Deals.Queries.GetDealBoard;
using Metup.Application.Deals.Queries.GetDealBoardCard;
using Metup.Application.Deals.Queries.GetDealBoardColumn;
using Metup.Application.Deals.Queries.GetDealById;
using Metup.Application.Deals.Queries.GetPipelineEvolution;
using Metup.Application.Deals.Queries.GetPipelineSummary;
using Metup.Application.Deals.Queries.ListDeals;
using Metup.Domain.Deals;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Metup.Server.Controllers;

/// <remarks>
/// Regra de acesso atual: todo usuário autenticado opera os negócios da própria organização.
/// O escopo por organização é resolvido no handler (ICurrentUserService), nunca pelo client.
/// Quadro, resumo e evolução seguem o escopo do dashboard (<c>ResolveDealOwnerScope</c>): o SDR só
/// enxerga os próprios negócios ali.
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

    /// <remarks>
    /// Mesma etapa = 200 sem nova transição. <c>expectedFromStage</c> diferente da etapa atual = 409
    /// com a ficha atual em <c>current</c>. <c>?view=card</c> devolve o cartão do quadro no 200 (o
    /// corpo do 409 é sempre a ficha completa).
    /// </remarks>
    [HttpPost("{id:guid}/stage")]
    public async Task<IActionResult> ChangeStage(
        Guid id,
        ChangeDealStageRequest request,
        [FromQuery] DealResponseView view = DealResponseView.Full,
        CancellationToken cancellationToken = default)
    {
        var deal = await sender.Send(new ChangeDealStageCommand(id, request.Stage, request.ExpectedFromStage), cancellationToken);

        return view == DealResponseView.Card
            ? Ok(await sender.Send(new GetDealBoardCardQuery(id), cancellationToken))
            : Ok(deal);
    }

    [HttpPost("{id:guid}/close")]
    public async Task<ActionResult<DealDto>> Close(
        Guid id,
        CloseDealRequest request,
        CancellationToken cancellationToken) =>
        Ok(await sender.Send(
            new CloseDealCommand(id, request.Won, request.ClosedAmount, request.LostReason, request.LostNote),
            cancellationToken));

    /// <summary>
    /// Quadro do pipeline: sete etapas ativas (fotografia do agora) e Fechados no período
    /// (<c>from</c>/<c>to</c>, datas locais inclusive; padrão = últimos 30 dias). Escopo resolvido no
    /// caso de uso: sem pedido = os próprios negócios; SDR que pede outros é rebaixado para os próprios.
    /// </summary>
    [HttpGet("board")]
    public async Task<ActionResult<DealBoardDto>> Board(
        [FromQuery] Guid? ownerUserId,
        [FromQuery] DealSource[]? sources,
        [FromQuery] string[]? segments,
        [FromQuery] string? search,
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] bool allOwners = false,
        [FromQuery] DealBoardSort sort = DealBoardSort.Stalled,
        [FromQuery] int perColumn = DealBoardReader.DefaultPerColumn,
        CancellationToken cancellationToken = default)
    {
        var filter = new DealPipelineFilter(ownerUserId, allOwners, sources, segments, search);
        return Ok(await sender.Send(new GetDealBoardQuery(filter, from, to, sort, perColumn), cancellationToken));
    }

    /// <summary>"Carregar mais" de uma coluna: <c>stage</c> (etapa ativa) ou <c>closed=won|lost</c>, com os filtros do quadro.</summary>
    [HttpGet("board/column")]
    public async Task<ActionResult<DealBoardColumnDto>> BoardColumn(
        [FromQuery] DealStage? stage,
        [FromQuery] DealBoardClosedGroup? closed,
        [FromQuery] Guid? ownerUserId,
        [FromQuery] DealSource[]? sources,
        [FromQuery] string[]? segments,
        [FromQuery] string? search,
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] bool allOwners = false,
        [FromQuery] DealBoardSort sort = DealBoardSort.Stalled,
        [FromQuery] int page = 1,
        [FromQuery] int perColumn = DealBoardReader.DefaultPerColumn,
        CancellationToken cancellationToken = default)
    {
        var filter = new DealPipelineFilter(ownerUserId, allOwners, sources, segments, search);
        var query = new GetDealBoardColumnQuery(filter, stage, closed, from, to, sort, page, perColumn);
        return Ok(await sender.Send(query, cancellationToken));
    }

    /// <summary>KPIs (com o período anterior), sparklines e funil em coorte; mesmos filtros do quadro.</summary>
    [HttpGet("pipeline-summary")]
    public async Task<ActionResult<PipelineSummaryDto>> PipelineSummary(
        [FromQuery] Guid? ownerUserId,
        [FromQuery] DealSource[]? sources,
        [FromQuery] string[]? segments,
        [FromQuery] string? search,
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] bool allOwners = false,
        CancellationToken cancellationToken = default)
    {
        var filter = new DealPipelineFilter(ownerUserId, allOwners, sources, segments, search);
        return Ok(await sender.Send(new GetPipelineSummaryQuery(filter, from, to), cancellationToken));
    }

    /// <summary>Pipeline total e receita prevista no fim de cada mês local (<c>months</c> = 3, 6 ou 12).</summary>
    [HttpGet("pipeline-evolution")]
    public async Task<ActionResult<PipelineEvolutionDto>> PipelineEvolution(
        [FromQuery] Guid? ownerUserId,
        [FromQuery] DealSource[]? sources,
        [FromQuery] string[]? segments,
        [FromQuery] string? search,
        [FromQuery] bool allOwners = false,
        [FromQuery] int months = 6,
        CancellationToken cancellationToken = default)
    {
        var filter = new DealPipelineFilter(ownerUserId, allOwners, sources, segments, search);
        return Ok(await sender.Send(new GetPipelineEvolutionQuery(filter, months), cancellationToken));
    }

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

/// <param name="ExpectedFromStage">Etapa em que o client viu o negócio (opcional) — protege o arrasto concorrente.</param>
public record ChangeDealStageRequest(DealStage Stage, DealStage? ExpectedFromStage = null);

/// <param name="LostReason">Obrigatório ao fechar como perdido; proibido no ganho.</param>
public record CloseDealRequest(bool Won, decimal? ClosedAmount, LostReason? LostReason = null, string? LostNote = null);

/// <summary>Forma da resposta de uma ação sobre o negócio: a ficha completa ou o cartão do quadro.</summary>
public enum DealResponseView
{
    Full,
    Card,
}
