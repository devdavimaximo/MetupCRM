using Metup.Domain.Users;
using MediatR;

namespace Metup.Application.Auth.Commands.Login;

public record LoginCommand(string Email, string Password) : IRequest<LoginResult>;

public record LoginResult(
    string Token,
    DateTime ExpiresAtUtc,
    Guid UserId,
    Guid OrganizationId,
    string Name,
    string Email,
    UserRole Role);
