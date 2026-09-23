using Metup.Application.Common.Interfaces;
using Metup.Application.Users.Common;
using Metup.Domain.Users;
using MediatR;

namespace Metup.Application.Users.Commands.ResetUserPassword;

public class ResetUserPasswordCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    IPasswordHasher passwordHasher) : IRequestHandler<ResetUserPasswordCommand>
{
    public async Task Handle(ResetUserPasswordCommand request, CancellationToken cancellationToken)
    {
        currentUserService.RequirePermission(Permission.UsersManage);
        var organizationId = currentUserService.RequireOrganizationId();

        var user = await context.GetManageableUserAsync(currentUserService, organizationId, request.Id, cancellationToken);
        user.PasswordHash = passwordHasher.Hash(request.Password);

        await context.SaveChangesAsync(cancellationToken);
    }
}
