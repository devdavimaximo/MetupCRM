using Metup.Application.Common.Interfaces;
using Metup.Application.Users.Common;
using Metup.Domain.Common.Exceptions;
using Metup.Domain.Users;
using MediatR;

namespace Metup.Application.Users.Commands.SetUserActive;

public class SetUserActiveCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<SetUserActiveCommand, ManagedUserDto>
{
    public async Task<ManagedUserDto> Handle(SetUserActiveCommand request, CancellationToken cancellationToken)
    {
        currentUserService.RequirePermission(Permission.UsersManage);
        var organizationId = currentUserService.RequireOrganizationId();

        if (!request.IsActive && request.Id == currentUserService.RequireUserId())
        {
            throw new DomainRuleException("Você não pode desativar o próprio usuário.");
        }

        var user = await context.GetManageableUserAsync(currentUserService, organizationId, request.Id, cancellationToken);
        user.IsActive = request.IsActive;

        await context.EnsureActiveAdministratorRemainsAsync(organizationId, user, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);

        return await context.GetManagedUserAsync(organizationId, user.Id, cancellationToken);
    }
}
