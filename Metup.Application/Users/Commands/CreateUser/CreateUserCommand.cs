using Metup.Application.Users.Common;
using MediatR;

namespace Metup.Application.Users.Commands.CreateUser;

public record CreateUserCommand(string Name, string Email, string Password, Guid RoleId) : IRequest<ManagedUserDto>;
