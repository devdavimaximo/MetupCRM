using Metup.Application.Users.Commands.CreateUser;
using Metup.Application.Users.Commands.ResetUserPassword;
using Metup.Application.Users.Commands.SetUserActive;
using Metup.Application.Users.Commands.UpdateUser;
using Metup.Application.Users.Common;
using Metup.Application.Users.Queries.ListManagedUsers;
using Metup.Application.Users.Queries.ListUsers;
using Metup.Domain.Users;
using Metup.Server.Security;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Metup.Server.Controllers;

/// <remarks>
/// <c>GET /api/users</c> é a listagem enxuta dos seletores de responsável (qualquer usuário logado).
/// O resto é a administração de usuários — só com <see cref="Permission.UsersManage"/>.
/// </remarks>
[ApiController]
[Authorize]
[Route("api/users")]
public class UsersController(ISender sender) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<UserSummaryDto>>> List(CancellationToken cancellationToken) =>
        Ok(await sender.Send(new ListUsersQuery(), cancellationToken));

    [HttpGet("manage")]
    [RequirePermission(Permission.UsersManage)]
    public async Task<ActionResult<IReadOnlyList<ManagedUserDto>>> ListManaged(CancellationToken cancellationToken) =>
        Ok(await sender.Send(new ListManagedUsersQuery(), cancellationToken));

    [HttpPost]
    [RequirePermission(Permission.UsersManage)]
    public async Task<ActionResult<ManagedUserDto>> Create(CreateUserCommand command, CancellationToken cancellationToken)
    {
        var user = await sender.Send(command, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, user);
    }

    [HttpPut("{id:guid}")]
    [RequirePermission(Permission.UsersManage)]
    public async Task<ActionResult<ManagedUserDto>> Update(Guid id, UpdateUserRequest request, CancellationToken cancellationToken) =>
        Ok(await sender.Send(new UpdateUserCommand(id, request.Name, request.Email, request.RoleId), cancellationToken));

    [HttpPut("{id:guid}/password")]
    [RequirePermission(Permission.UsersManage)]
    public async Task<IActionResult> ResetPassword(Guid id, ResetPasswordRequest request, CancellationToken cancellationToken)
    {
        await sender.Send(new ResetUserPasswordCommand(id, request.Password), cancellationToken);
        return NoContent();
    }

    [HttpPut("{id:guid}/active")]
    [RequirePermission(Permission.UsersManage)]
    public async Task<ActionResult<ManagedUserDto>> SetActive(Guid id, SetActiveRequest request, CancellationToken cancellationToken) =>
        Ok(await sender.Send(new SetUserActiveCommand(id, request.IsActive), cancellationToken));
}

public record UpdateUserRequest(string Name, string Email, Guid RoleId);

public record ResetPasswordRequest(string Password);

public record SetActiveRequest(bool IsActive);
