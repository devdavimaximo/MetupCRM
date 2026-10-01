using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Users.Common;
using Metup.Domain.Organizations;
using Metup.Domain.Users;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Auth.Commands.RegisterOrganization;

/// <remarks>
/// A organização nasce com os cargos padrão (Administrador, Closer, SDR); quem cadastra é o administrador.
/// Com o cadastro público fechado (<see cref="IRegistrationPolicy"/>), só a primeira organização passa.
/// </remarks>
public class RegisterOrganizationCommandHandler(
    IApplicationDbContext context,
    IPasswordHasher passwordHasher,
    IRegistrationPolicy registrationPolicy) : IRequestHandler<RegisterOrganizationCommand, RegisterOrganizationResult>
{
    public async Task<RegisterOrganizationResult> Handle(RegisterOrganizationCommand request, CancellationToken cancellationToken)
    {
        if (!registrationPolicy.AllowsAdditionalOrganizations
            && await context.Organizations.AnyAsync(cancellationToken))
        {
            throw new ForbiddenAccessException("Cadastro de novas organizações está desativado.");
        }

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
