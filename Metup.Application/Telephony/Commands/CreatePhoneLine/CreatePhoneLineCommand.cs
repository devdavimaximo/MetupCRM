using Metup.Application.Telephony.Common;
using Metup.Domain.Telephony;
using MediatR;

namespace Metup.Application.Telephony.Commands.CreatePhoneLine;

/// <param name="IsDefault">Vira a principal do usuário. A primeira linha ativa dele é principal de qualquer jeito.</param>
public record CreatePhoneLineCommand(
    Guid UserId,
    PhoneLineKind Kind,
    string Label,
    string Number,
    bool IsDefault) : IRequest<PhoneLineDto>;
