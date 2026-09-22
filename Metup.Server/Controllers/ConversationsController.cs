using Metup.Application.Common.Models;
using Metup.Application.Conversations.Commands.ApplyConversationTag;
using Metup.Application.Conversations.Commands.FavoriteConversation;
using Metup.Application.Conversations.Commands.MarkConversationRead;
using Metup.Application.Conversations.Commands.MarkConversationUnread;
using Metup.Application.Conversations.Commands.RemoveConversationTag;
using Metup.Application.Conversations.Commands.SendMessage;
using Metup.Application.Conversations.Commands.SetConversationAutomation;
using Metup.Application.Conversations.Commands.UnfavoriteConversation;
using Metup.Application.Conversations.Commands.UpdateConversationStatus;
using Metup.Application.Conversations.Common;
using Metup.Application.Conversations.Queries.GetConversationContext;
using Metup.Application.Conversations.Queries.GetConversationMessages;
using Metup.Application.Conversations.Queries.GetConversationsSummary;
using Metup.Application.Conversations.Queries.ListConversations;
using Metup.Application.Conversations.Queries.ListConversationTagOptions;
using Metup.Domain.Conversations;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Metup.Server.Controllers;

/// <remarks>
/// Inbox de WhatsApp — dado e tela são do código; quem entrega de fato via WhatsApp é o n8n
/// (seção 5 do CLAUDE.md). Toda conversa nasce de uma mensagem inbound (ver
/// WhatsAppIngestionController); aqui o SDR só lê e responde threads que já existem.
/// </remarks>
[ApiController]
[Authorize]
[Route("api/conversations")]
public class ConversationsController(ISender sender) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<ConversationListItemDto>>> List(
        [FromQuery] string? search,
        [FromQuery] ConversationChannel[]? channel,
        [FromQuery] ConversationStatus[]? status,
        [FromQuery] bool? unread,
        [FromQuery] bool? favorite,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var query = new ListConversationsQuery(search, channel, status, unread, favorite, page, pageSize);
        return Ok(await sender.Send(query, cancellationToken));
    }

    [HttpGet("summary")]
    public async Task<ActionResult<ConversationCountsDto>> GetSummary(CancellationToken cancellationToken) =>
        Ok(await sender.Send(new GetConversationsSummaryQuery(), cancellationToken));

    [HttpGet("tag-options")]
    public async Task<ActionResult<IReadOnlyList<ConversationTagOptionDto>>> ListTagOptions(
        [FromQuery] string? search,
        CancellationToken cancellationToken) =>
        Ok(await sender.Send(new ListConversationTagOptionsQuery(search), cancellationToken));

    [HttpGet("{id:guid}/messages")]
    public async Task<ActionResult<IReadOnlyList<MessageDto>>> ListMessages(
        Guid id,
        CancellationToken cancellationToken) =>
        Ok(await sender.Send(new GetConversationMessagesQuery(id), cancellationToken));

    [HttpGet("{id:guid}/context")]
    public async Task<ActionResult<ConversationContextDto>> GetContext(
        Guid id,
        CancellationToken cancellationToken) =>
        Ok(await sender.Send(new GetConversationContextQuery(id), cancellationToken));

    [HttpPost("{id:guid}/messages")]
    public async Task<ActionResult<MessageDto>> SendMessage(
        Guid id,
        SendMessageRequest request,
        CancellationToken cancellationToken) =>
        Ok(await sender.Send(new SendMessageCommand(id, request.Body), cancellationToken));

    [HttpPut("{id:guid}/status")]
    public async Task<IActionResult> UpdateStatus(
        Guid id,
        UpdateConversationStatusRequest request,
        CancellationToken cancellationToken)
    {
        await sender.Send(new UpdateConversationStatusCommand(id, request.Status), cancellationToken);
        return NoContent();
    }

    [HttpPost("{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id, CancellationToken cancellationToken)
    {
        await sender.Send(new MarkConversationReadCommand(id), cancellationToken);
        return NoContent();
    }

    [HttpDelete("{id:guid}/read")]
    public async Task<IActionResult> MarkUnread(Guid id, CancellationToken cancellationToken)
    {
        await sender.Send(new MarkConversationUnreadCommand(id), cancellationToken);
        return NoContent();
    }

    [HttpPost("{id:guid}/favorite")]
    public async Task<IActionResult> Favorite(Guid id, CancellationToken cancellationToken)
    {
        await sender.Send(new FavoriteConversationCommand(id), cancellationToken);
        return NoContent();
    }

    [HttpDelete("{id:guid}/favorite")]
    public async Task<IActionResult> Unfavorite(Guid id, CancellationToken cancellationToken)
    {
        await sender.Send(new UnfavoriteConversationCommand(id), cancellationToken);
        return NoContent();
    }

    [HttpPost("{id:guid}/tags")]
    public async Task<IActionResult> ApplyTag(
        Guid id,
        ApplyConversationTagRequest request,
        CancellationToken cancellationToken)
    {
        await sender.Send(new ApplyConversationTagCommand(id, request.Name), cancellationToken);
        return NoContent();
    }

    [HttpDelete("{id:guid}/tags/{tagOptionId:guid}")]
    public async Task<IActionResult> RemoveTag(Guid id, Guid tagOptionId, CancellationToken cancellationToken)
    {
        await sender.Send(new RemoveConversationTagCommand(id, tagOptionId), cancellationToken);
        return NoContent();
    }

    [HttpPut("{id:guid}/automation")]
    public async Task<IActionResult> SetAutomation(
        Guid id,
        SetConversationAutomationRequest request,
        CancellationToken cancellationToken)
    {
        await sender.Send(new SetConversationAutomationCommand(id, request.Enabled), cancellationToken);
        return NoContent();
    }
}

public record SendMessageRequest(string Body);

public record UpdateConversationStatusRequest(ConversationStatus Status);

public record ApplyConversationTagRequest(string Name);

public record SetConversationAutomationRequest(bool Enabled);
