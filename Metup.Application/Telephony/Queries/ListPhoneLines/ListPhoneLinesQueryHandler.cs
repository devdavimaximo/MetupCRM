using Metup.Application.Common.Interfaces;
using Metup.Application.Telephony.Common;
using Metup.Domain.Users;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Telephony.Queries.ListPhoneLines;

public class ListPhoneLinesQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<ListPhoneLinesQuery, IReadOnlyList<PhoneLineDto>>
{
    public async Task<IReadOnlyList<PhoneLineDto>> Handle(ListPhoneLinesQuery request, CancellationToken cancellationToken)
    {
        currentUserService.RequirePermission(Permission.PhoneLinesManage);
        var organizationId = currentUserService.RequireOrganizationId();

        var lines = await context.PhoneLines
            .AsNoTracking()
            .Where(l => l.OrganizationId == organizationId)
            .ToPhoneLineDto(context)
            .ToListAsync(cancellationToken);

        return [.. lines
            .OrderBy(l => l.UserName, StringComparer.CurrentCultureIgnoreCase)
            .ThenByDescending(l => l.IsActive)
            .ThenByDescending(l => l.IsDefault)
            .ThenBy(l => l.Label, StringComparer.CurrentCultureIgnoreCase)];
    }
}

/// <summary>Só as próprias, nunca as de outra pessoa: a linha é de quem liga.</summary>
public class ListMyPhoneLinesQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<ListMyPhoneLinesQuery, IReadOnlyList<PhoneLineDto>>
{
    public async Task<IReadOnlyList<PhoneLineDto>> Handle(ListMyPhoneLinesQuery request, CancellationToken cancellationToken)
    {
        currentUserService.RequirePermission(Permission.DialerView);
        var organizationId = currentUserService.RequireOrganizationId();
        var userId = currentUserService.RequireUserId();

        return await context.PhoneLines
            .AsNoTracking()
            .Where(l => l.OrganizationId == organizationId && l.UserId == userId && l.IsActive)
            .OrderByDescending(l => l.IsDefault)
            .ThenBy(l => l.Label)
            .ToPhoneLineDto(context)
            .ToListAsync(cancellationToken);
    }
}
