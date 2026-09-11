using Metup.Application.Common.Models;
using Metup.Application.Conversations.Commands.SendMessage;
using Metup.Application.Conversations.Common;
using Metup.Application.Conversations.Queries.GetConversationContext;
using Metup.Application.Conversations.Queries.GetConversationMessages;
using Metup.Application.Conversations.Queries.ListConversations;
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
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var query = new ListConversationsQuery(search, page, pageSize);
        return Ok(await sender.Send(query, cancellationToken));
    }

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
}

public record SendMessageRequest(string Body);
