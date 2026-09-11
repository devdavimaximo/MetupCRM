using Metup.Application.Users.Common;
using Metup.Application.Users.Queries.ListUsers;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Metup.Server.Controllers;

/// <remarks>Hoje só a listagem enxuta que alimenta o seletor de responsável do negócio.</remarks>
[ApiController]
[Authorize]
[Route("api/users")]
public class UsersController(ISender sender) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<UserSummaryDto>>> List(CancellationToken cancellationToken) =>
        Ok(await sender.Send(new ListUsersQuery(), cancellationToken));
}
