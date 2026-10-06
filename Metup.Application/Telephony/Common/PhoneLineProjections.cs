using Metup.Application.Common.Interfaces;
using Metup.Domain.Telephony;

namespace Metup.Application.Telephony.Common;

public static class PhoneLineProjections
{
    public static IQueryable<PhoneLineDto> ToPhoneLineDto(this IQueryable<PhoneLine> lines, IApplicationDbContext context) =>
        from l in lines
        join u in context.Users on l.UserId equals u.Id
        select new PhoneLineDto(l.Id, l.UserId, u.Name, l.Kind, l.Label, l.Number, l.NumberE164, l.IsDefault, l.IsActive, l.CreatedAt);
}
