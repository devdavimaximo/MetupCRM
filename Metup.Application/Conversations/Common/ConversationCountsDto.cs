namespace Metup.Application.Conversations.Common;

/// <summary>Alimenta as 3 abas fixas da lista (Todas/Não lidas/Favoritas) — GET /api/conversations/summary.</summary>
public record ConversationCountsDto(int Total, int Unread, int Favorite);
