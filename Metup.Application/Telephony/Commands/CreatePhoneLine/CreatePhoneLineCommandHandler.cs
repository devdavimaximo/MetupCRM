using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Extensions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Telephony.Common;
using Metup.Domain.Telephony;
using Metup.Domain.Users;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Telephony.Commands.CreatePhoneLine;

/// <summary>Quem cadastra é o administrador (<see cref="Permission.PhoneLinesManage"/>), para qualquer usuário ativo.</summary>
public class CreatePhoneLineCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    IOrganizationClock organizationClock) : IRequestHandler<CreatePhoneLineCommand, PhoneLineDto>
{
    public async Task<PhoneLineDto> Handle(CreatePhoneLineCommand request, CancellationToken cancellationToken)
    {
        currentUserService.RequirePermission(Permission.PhoneLinesManage);
        var organizationId = currentUserService.RequireOrganizationId();
        var currentUserId = currentUserService.RequireUserId();

        var userIsActiveMember = await context.Users
            .AnyAsync(u => u.Id == request.UserId && u.OrganizationId == organizationId && u.IsActive, cancellationToken);
        if (!userIsActiveMember)
        {
            throw new NotFoundException("Usuário");
        }

        var numberE164 = request.Number.ToBrazilianE164()!;
        await context.EnsureNumberAvailableAsync(organizationId, numberE164, exceptLineId: null, cancellationToken);

        var hasActiveLine = await context.PhoneLines
            .AnyAsync(l => l.OrganizationId == organizationId && l.UserId == request.UserId && l.IsActive, cancellationToken);
        var isDefault = request.IsDefault || !hasActiveLine;

        var clock = await organizationClock.SnapshotAsync(cancellationToken);
        var line = PhoneLine.Create(
            organizationId,
            request.UserId,
            request.Kind,
            request.Label.Trim(),
            request.Number.Trim(),
            numberE164,
            isDefault,
            currentUserId,
            clock.UtcNow);

        if (isDefault)
        {
            await context.ClearOtherDefaultsAsync(organizationId, request.UserId, line.Id, cancellationToken);
        }

        context.PhoneLines.Add(line);
        await context.SaveChangesAsync(cancellationToken);

        return await context.PhoneLines
            .AsNoTracking()
            .Where(l => l.Id == line.Id)
            .ToPhoneLineDto(context)
            .FirstAsync(cancellationToken);
    }
}
