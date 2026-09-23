using Metup.Application.Roles.Common;
using Metup.Domain.Users;
using MediatR;

namespace Metup.Application.Roles.Commands.CreateRole;

public record CreateRoleCommand(string Name, string? Description, IReadOnlyList<Permission> Permissions) : IRequest<RoleDto>;
