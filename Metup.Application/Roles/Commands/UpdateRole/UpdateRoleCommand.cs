using Metup.Application.Roles.Common;
using Metup.Domain.Users;
using MediatR;

namespace Metup.Application.Roles.Commands.UpdateRole;

/// <summary>Muda nome, descrição e permissões; vale na próxima requisição de cada usuário do cargo.</summary>
public record UpdateRoleCommand(Guid Id, string Name, string? Description, IReadOnlyList<Permission> Permissions) : IRequest<RoleDto>;
