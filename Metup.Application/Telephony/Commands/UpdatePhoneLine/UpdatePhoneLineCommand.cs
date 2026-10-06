using Metup.Application.Telephony.Common;
using MediatR;

namespace Metup.Application.Telephony.Commands.UpdatePhoneLine;

/// <remarks>
/// A linha não troca de dono: passar um número para outra pessoa é desativar aqui e cadastrar lá —
/// as ligações antigas continuam atribuídas a quem ligou.
/// </remarks>
/// <param name="MakeDefault">true promove a linha a principal; false não mexe (a principal só muda promovendo outra).</param>
public record UpdatePhoneLineCommand(Guid Id, string Label, string Number, bool MakeDefault) : IRequest<PhoneLineDto>;
