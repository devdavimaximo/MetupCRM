using Metup.Application.Conversations.Common;
using MediatR;

namespace Metup.Application.Conversations.Queries.GetConversationsSummary;

/// <summary>Contagens das 3 abas fixas da lista (Todas/Não lidas/Favoritas) — sem filtro de canal/status.</summary>
public record GetConversationsSummaryQuery : IRequest<ConversationCountsDto>;
