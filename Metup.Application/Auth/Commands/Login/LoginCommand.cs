using Metup.Application.Users.Common;
using MediatR;

namespace Metup.Application.Auth.Commands.Login;

public record LoginCommand(string Email, string Password) : IRequest<LoginResult>;

public record LoginResult(string Token, DateTime ExpiresAtUtc, CurrentUserDto User);
