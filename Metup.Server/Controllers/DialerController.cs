using Metup.Application.Dialer.Common;
using Metup.Application.Dialer.Queries.GetDialerQueue;
using Metup.Application.Telephony.Common;
using Metup.Application.Telephony.Queries.ListPhoneLines;
using Metup.Domain.Users;
using Metup.Server.Security;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Metup.Server.Controllers;

/// <remarks>
/// O discador lê daqui a fila e as linhas do usuário logado — nunca as de outra pessoa. O registro da
/// ligação é o mesmo de qualquer atividade (<see cref="ActivitiesController"/>, com <c>phoneLineId</c>).
/// A chamada em si não passa pelo servidor: no modo aparelho o navegador abre o <c>tel:</c>.
/// </remarks>
[ApiController]
[Authorize]
[RequirePermission(Permission.DialerView)]
[Route("api/dialer")]
public class DialerController(ISender sender) : ControllerBase
{
    [HttpGet("queue")]
    public async Task<ActionResult<DialerQueueDto>> Queue(CancellationToken cancellationToken) =>
        Ok(await sender.Send(new GetDialerQueueQuery(), cancellationToken));

    [HttpGet("lines")]
    public async Task<ActionResult<IReadOnlyList<PhoneLineDto>>> MyLines(CancellationToken cancellationToken) =>
        Ok(await sender.Send(new ListMyPhoneLinesQuery(), cancellationToken));
}
