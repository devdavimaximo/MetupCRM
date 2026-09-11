using Metup.Application.Common.Models;
using Metup.Application.Conversations.Common;
using MediatR;

namespace Metup.Application.Conversations.Queries.ListConversations;

/// <param name="Search">Filtra por nome do contato ou da empresa — sem filtro, lista tudo.</param>
public record ListConversationsQuery(
    string? Search = null,
    int Page = 1,
    int PageSize = 50) : IRequest<PagedResult<ConversationListItemDto>>;
