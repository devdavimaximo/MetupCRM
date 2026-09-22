using Metup.Application.Conversations.Common;
using MediatR;

namespace Metup.Application.Conversations.Queries.ListConversationTagOptions;

/// <param name="Search">Autocompletar — sem filtro, lista o catálogo inteiro da organização.</param>
public record ListConversationTagOptionsQuery(string? Search = null) : IRequest<IReadOnlyList<ConversationTagOptionDto>>;
