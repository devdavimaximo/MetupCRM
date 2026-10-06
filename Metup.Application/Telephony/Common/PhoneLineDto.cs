using Metup.Domain.Telephony;

namespace Metup.Application.Telephony.Common;

public record PhoneLineDto(
    Guid Id,
    Guid UserId,
    string UserName,
    PhoneLineKind Kind,
    string Label,
    string Number,
    string NumberE164,
    bool IsDefault,
    bool IsActive,
    DateTime CreatedAt);
