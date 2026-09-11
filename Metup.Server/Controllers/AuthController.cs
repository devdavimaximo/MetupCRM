using Metup.Application.Auth.Commands.Login;
using Metup.Application.Auth.Commands.RegisterOrganization;
using Metup.Application.Common.Interfaces;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Metup.Server.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(ISender sender, ICurrentUserService currentUserService) : ControllerBase
{
    [HttpPost("register")]
    public async Task<ActionResult<RegisterOrganizationResult>> Register(
        RegisterOrganizationCommand command,
        CancellationToken cancellationToken)
    {
        var result = await sender.Send(command, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    [HttpPost("login")]
    public async Task<ActionResult<LoginResult>> Login(LoginCommand command, CancellationToken cancellationToken)
    {
        var result = await sender.Send(command, cancellationToken);
        return Ok(result);
    }

    [HttpGet("me")]
    [Authorize]
    public IActionResult Me()
    {
        return Ok(new
        {
            currentUserService.UserId,
            currentUserService.OrganizationId,
            currentUserService.Role,
        });
    }
}
