using Metup.Application.Dialer.Common;
using MediatR;

namespace Metup.Application.Dialer.Queries.GetDialerQueue;

/// <summary>
/// A fila do discador: as ligações pendentes do usuário logado vencendo até o fim de hoje (atrasadas
/// primeiro). Sempre a do próprio usuário — cada SDR disca a sua carteira, e é isso que impede dois
/// SDRs de ligarem para o mesmo lead.
/// </summary>
public record GetDialerQueueQuery : IRequest<DialerQueueDto>;
