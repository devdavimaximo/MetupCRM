using Metup.Application.Common.Interfaces;
using Metup.Application.Users.Common;
using Metup.Domain.Users;
using MediatR;

namespace Metup.Application.Users.Commands.CreateUser;

public class CreateUserCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    IPasswordHasher passwordHasher) : IRequestHandler<CreateUserCommand, ManagedUserDto>
{
    public async Task<ManagedUserDto> Handle(CreateUserCommand request, CancellationToken cancellationToken)
    {
        currentUserService.RequirePermission(Permission.UsersManage);
        var organizationId = currentUserService.RequireOrganizationId();

        var email = UserEmail.Normalize(request.Email);
        await context.EnsureEmailAvailableAsync(email, exceptUserId: null, nameof(request.Email), cancellationToken);

        var role = await context.GetRoleAsync(organizationId, request.RoleId, cancellationToken);
        currentUserService.RequireCanGrant(role.EffectivePermissions);

        var user = new User
        {
            OrganizationId = organizationId,
            Name = request.Name.Trim(),
            Email = email,
            PasswordHash = passwordHasher.Hash(request.Password),
            RoleId = role.Id,
        };

        context.Users.Add(user);
        await context.SaveChangesAsync(cancellationToken);

        return new ManagedUserDto(user.Id, user.Name, user.Email, role.Id, role.Name, user.IsActive, user.CreatedAt);
    }
}
