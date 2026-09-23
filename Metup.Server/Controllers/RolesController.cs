using Metup.Application.Roles.Commands.CreateRole;
using Metup.Application.Roles.Commands.DeleteRole;
using Metup.Application.Roles.Commands.UpdateRole;
using Metup.Application.Roles.Common;
using Metup.Application.Roles.Queries.ListRoles;
using Metup.Domain.Users;
using Metup.Server.Security;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Metup.Server.Controllers;

/// <remarks>Cargos e suas permissões. Ler também serve a quem gerencia usuários (escolher o cargo).</remarks>
[ApiController]
[Authorize]
[Route("api/roles")]
public class RolesController(ISender sender) : ControllerBase
{
    [HttpGet]
    [RequirePermission(Permission.RolesManage, Permission.UsersManage)]
    public async Task<ActionResult<IReadOnlyList<RoleDto>>> List(CancellationToken cancellationToken) =>
        Ok(await sender.Send(new ListRolesQuery(), cancellationToken));

    [HttpPost]
    [RequirePermission(Permission.RolesManage)]
    public async Task<ActionResult<RoleDto>> Create(CreateRoleCommand command, CancellationToken cancellationToken)
    {
        var role = await sender.Send(command, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, role);
    }

    [HttpPut("{id:guid}")]
    [RequirePermission(Permission.RolesManage)]
    public async Task<ActionResult<RoleDto>> Update(Guid id, UpdateRoleRequest request, CancellationToken cancellationToken) =>
        Ok(await sender.Send(new UpdateRoleCommand(id, request.Name, request.Description, request.Permissions), cancellationToken));

    [HttpDelete("{id:guid}")]
    [RequirePermission(Permission.RolesManage)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        await sender.Send(new DeleteRoleCommand(id), cancellationToken);
        return NoContent();
    }
}

public record UpdateRoleRequest(string Name, string? Description, IReadOnlyList<Permission> Permissions);
