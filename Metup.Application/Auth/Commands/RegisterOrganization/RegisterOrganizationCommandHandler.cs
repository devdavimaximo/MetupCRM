using FluentValidation;
using FluentValidation.Results;
using Metup.Application.Common.Interfaces;
using Metup.Domain.Organizations;
using Metup.Domain.Users;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Auth.Commands.RegisterOrganization;

public class RegisterOrganizationCommandHandler(
    IApplicationDbContext context,
    IPasswordHasher passwordHasher) : IRequestHandler<RegisterOrganizationCommand, RegisterOrganizationResult>
{
    public async Task<RegisterOrganizationResult> Handle(RegisterOrganizationCommand request, CancellationToken cancellationToken)
    {
        var emailInUse = await context.Users
            .AnyAsync(u => u.Email == request.AdminEmail, cancellationToken);

        if (emailInUse)
        {
            throw new ValidationException(
            [
                new ValidationFailure(nameof(request.AdminEmail), "Já existe um usuário com este e-mail."),
            ]);
        }

        var organization = new Organization
        {
            Name = request.OrganizationName,
        };

        var admin = new User
        {
            OrganizationId = organization.Id,
            Name = request.AdminName,
            Email = request.AdminEmail,
            PasswordHash = passwordHasher.Hash(request.AdminPassword),
            Role = UserRole.Admin,
        };

        context.Organizations.Add(organization);
        context.Users.Add(admin);

        await context.SaveChangesAsync(cancellationToken);

        return new RegisterOrganizationResult(organization.Id, admin.Id, admin.Name, admin.Email, admin.Role);
    }
}
