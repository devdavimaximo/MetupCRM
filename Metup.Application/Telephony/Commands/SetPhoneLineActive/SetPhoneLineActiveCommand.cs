using Metup.Application.Telephony.Common;
using MediatR;

namespace Metup.Application.Telephony.Commands.SetPhoneLineActive;

/// <summary>Desativar no lugar de excluir: as ligações feitas pela linha continuam apontando para ela.</summary>
public record SetPhoneLineActiveCommand(Guid Id, bool IsActive) : IRequest<PhoneLineDto>;
