using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Extensions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Telephony.Common;
using Metup.Domain.Users;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Telephony.Commands.UpdatePhoneLine;

public class UpdatePhoneLineCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<UpdatePhoneLineCommand, PhoneLineDto>
{
    public async Task<PhoneLineDto> Handle(UpdatePhoneLineCommand request, CancellationToken cancellationToken)
    {
        currentUserService.RequirePermission(Permission.PhoneLinesManage);
        var organizationId = currentUserService.RequireOrganizationId();

        var line = await context.PhoneLines
            .FirstOrDefaultAsync(l => l.Id == request.Id && l.OrganizationId == organizationId, cancellationToken)
            ?? throw new NotFoundException("Linha telefônica");

        var numberE164 = request.Number.ToBrazilianE164()!;
        if (line.IsActive && numberE164 != line.NumberE164)
        {
            await context.EnsureNumberAvailableAsync(organizationId, numberE164, line.Id, cancellationToken);
        }

        line.Update(request.Label.Trim(), request.Number.Trim(), numberE164);

        if (request.MakeDefault && !line.IsDefault)
        {
            line.MakeDefault();
            await context.ClearOtherDefaultsAsync(organizationId, line.UserId, line.Id, cancellationToken);
        }

        await context.SaveChangesAsync(cancellationToken);

        return await context.PhoneLines
            .AsNoTracking()
            .Where(l => l.Id == line.Id)
            .ToPhoneLineDto(context)
            .FirstAsync(cancellationToken);
    }
}
