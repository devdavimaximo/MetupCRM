using Metup.Application.Common.Models;
using Metup.Application.Conversations.Common;
using Metup.Domain.Conversations;
using MediatR;

namespace Metup.Application.Conversations.Queries.ListConversations;

/// <param name="Search">Filtra por nome do contato ou da empresa — sem filtro, lista tudo.</param>
/// <param name="Channel">Sem filtro, todos os canais.</param>
/// <param name="Status">Sem filtro, todos os status.</param>
/// <param name="Unread">true = só não lidas; false = só lidas; null = ambas.</param>
/// <param name="Favorite">true = só favoritas; false = só não favoritas; null = ambas.</param>
public record ListConversationsQuery(
    string? Search = null,
    IReadOnlyList<ConversationChannel>? Channel = null,
    IReadOnlyList<ConversationStatus>? Status = null,
    bool? Unread = null,
    bool? Favorite = null,
    int Page = 1,
    int PageSize = 50) : IRequest<PagedResult<ConversationListItemDto>>;
