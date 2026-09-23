using Metup.Application.Organizations.Commands.UpdateOrganizationSettings;
using Metup.Application.Organizations.Common;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Metup.Domain.Users;
using Metup.Server.Security;

namespace Metup.Server.Controllers;

/// <remarks>
/// Configurações da organização do usuário logado. Só com a permissão de configurações, aqui e de novo no caso de uso. Ainda
/// não há tela: a edição pela interface fica para o redesign de Configurações.
/// </remarks>
[ApiController]
[Authorize]
[RequirePermission(Permission.SettingsManage)]
[Route("api/organization/settings")]
public class OrganizationSettingsController(ISender sender) : ControllerBase
{
    [HttpPut]
    public async Task<ActionResult<OrganizationSettingsDto>> Update(
        UpdateOrganizationSettingsCommand command,
        CancellationToken cancellationToken) =>
        Ok(await sender.Send(command, cancellationToken));
}
