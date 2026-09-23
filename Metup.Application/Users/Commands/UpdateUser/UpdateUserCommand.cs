using Metup.Application.Users.Common;
using MediatR;

namespace Metup.Application.Users.Commands.UpdateUser;

public record UpdateUserCommand(Guid Id, string Name, string Email, Guid RoleId) : IRequest<ManagedUserDto>;
