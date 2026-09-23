using MediatR;

namespace Metup.Application.Roles.Commands.DeleteRole;

public record DeleteRoleCommand(Guid Id) : IRequest;
