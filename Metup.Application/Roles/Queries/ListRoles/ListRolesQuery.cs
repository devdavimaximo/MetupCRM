using Metup.Application.Roles.Common;
using MediatR;

namespace Metup.Application.Roles.Queries.ListRoles;

public record ListRolesQuery : IRequest<IReadOnlyList<RoleDto>>;
