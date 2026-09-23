using Metup.Application.Common.Interfaces;
using Metup.Application.Users.Common;
using Metup.Domain.Organizations;
using Metup.Domain.Users;
using MediatR;

namespace Metup.Application.Auth.Commands.RegisterOrganization;

/// <remarks>A organização nasce com os cargos padrão (Administrador, Closer, SDR); quem cadastra é o administrador.</remarks>
public class RegisterOrganizationCommandHandler(
    IApplicationDbContext context,
    IPasswordHasher passwordHasher) : IRequestHandler<RegisterOrganizationCommand, RegisterOrganizationResult>
{
    public async Task<RegisterOrganizationResult> Handle(RegisterOrganizationCommand request, CancellationToken cancellationToken)
    {
        var email = UserEmail.Normalize(request.AdminEmail);
        await context.EnsureEmailAvailableAsync(email, exceptUserId: null, nameof(request.AdminEmail), cancellationToken);

        var organization = new Organization
        {
            Name = request.OrganizationName,
        };

        var roles = Role.CreateDefaults(organization.Id);
        var administratorRole = roles.Single(r => r.IsAdministrator);

        var admin = new User
        {
            OrganizationId = organization.Id,
            Name = request.AdminName,
            Email = email,
            PasswordHash = passwordHasher.Hash(request.AdminPassword),
            RoleId = administratorRole.Id,
        };

        context.Organizations.Add(organization);
        context.Roles.AddRange(roles);
        context.Users.Add(admin);

        await context.SaveChangesAsync(cancellationToken);

        return new RegisterOrganizationResult(organization.Id, admin.Id, admin.Name, admin.Email, administratorRole.Name);
    }
}
