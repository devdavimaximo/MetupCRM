using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Telephony.Common;
using Metup.Domain.Users;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Telephony.Commands.SetPhoneLineActive;

/// <remarks>
/// Desativar a principal promove outra linha ativa do usuário; reativar exige o número livre e
/// devolve a principal a quem ficou sem nenhuma.
/// </remarks>
public class SetPhoneLineActiveCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<SetPhoneLineActiveCommand, PhoneLineDto>
{
    public async Task<PhoneLineDto> Handle(SetPhoneLineActiveCommand request, CancellationToken cancellationToken)
    {
        currentUserService.RequirePermission(Permission.PhoneLinesManage);
        var organizationId = currentUserService.RequireOrganizationId();

        var line = await context.PhoneLines
            .FirstOrDefaultAsync(l => l.Id == request.Id && l.OrganizationId == organizationId, cancellationToken)
            ?? throw new NotFoundException("Linha telefônica");

        if (request.IsActive && !line.IsActive)
        {
            await context.EnsureNumberAvailableAsync(organizationId, line.NumberE164, line.Id, cancellationToken);
            line.Reactivate();

            var userHasDefault = await context.PhoneLines.AnyAsync(
                l => l.OrganizationId == organizationId && l.UserId == line.UserId && l.IsActive && l.IsDefault && l.Id != line.Id,
                cancellationToken);
            if (!userHasDefault)
            {
                line.MakeDefault();
            }
        }
        else if (!request.IsActive && line.IsActive)
        {
            line.Deactivate();
            await context.EnsureUserHasDefaultAsync(organizationId, line.UserId, exceptLineId: line.Id, cancellationToken);
        }

        await context.SaveChangesAsync(cancellationToken);

        return await context.PhoneLines
            .AsNoTracking()
            .Where(l => l.Id == line.Id)
            .ToPhoneLineDto(context)
            .FirstAsync(cancellationToken);
    }
}
