using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Users.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Auth.Commands.Login;

/// <remarks>Usuário desativado recebe a mesma resposta de credencial inválida — não confirma que o e-mail existe.</remarks>
public class LoginCommandHandler(
    IApplicationDbContext context,
    IPasswordHasher passwordHasher,
    ITokenService tokenService) : IRequestHandler<LoginCommand, LoginResult>
{
    public async Task<LoginResult> Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        var email = UserEmail.Normalize(request.Email);

        var user = await context.Users
            .FirstOrDefaultAsync(u => u.Email.ToLower() == email, cancellationToken);

        if (user is null || !user.IsActive || !passwordHasher.Verify(user.PasswordHash, request.Password))
        {
            throw new InvalidCredentialsException();
        }

        var role = await context.GetRoleAsync(user.OrganizationId, user.RoleId, cancellationToken);
        var (token, expiresAtUtc) = tokenService.GenerateToken(user);

        return new LoginResult(
            token,
            expiresAtUtc,
            new CurrentUserDto(user.Id, user.OrganizationId, user.Name, user.Email, role.Id, role.Name, role.EffectivePermissions));
    }
}
