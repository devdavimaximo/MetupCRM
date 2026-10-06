using Metup.Application.Telephony.Commands.CreatePhoneLine;
using Metup.Application.Telephony.Commands.SetPhoneLineActive;
using Metup.Application.Telephony.Commands.UpdatePhoneLine;
using Metup.Application.Telephony.Common;
using Metup.Application.Telephony.Queries.ListPhoneLines;
using Metup.Domain.Users;
using Metup.Server.Security;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Metup.Server.Controllers;

/// <remarks>Administração das linhas de todos os usuários — só com <see cref="Permission.PhoneLinesManage"/>.</remarks>
[ApiController]
[Authorize]
[RequirePermission(Permission.PhoneLinesManage)]
[Route("api/phone-lines")]
public class PhoneLinesController(ISender sender) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PhoneLineDto>>> List(CancellationToken cancellationToken) =>
        Ok(await sender.Send(new ListPhoneLinesQuery(), cancellationToken));

    [HttpPost]
    public async Task<ActionResult<PhoneLineDto>> Create(CreatePhoneLineCommand command, CancellationToken cancellationToken)
    {
        var line = await sender.Send(command, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, line);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<PhoneLineDto>> Update(Guid id, UpdatePhoneLineRequest request, CancellationToken cancellationToken) =>
        Ok(await sender.Send(new UpdatePhoneLineCommand(id, request.Label, request.Number, request.MakeDefault), cancellationToken));

    [HttpPut("{id:guid}/active")]
    public async Task<ActionResult<PhoneLineDto>> SetActive(Guid id, SetPhoneLineActiveRequest request, CancellationToken cancellationToken) =>
        Ok(await sender.Send(new SetPhoneLineActiveCommand(id, request.IsActive), cancellationToken));
}

public record UpdatePhoneLineRequest(string Label, string Number, bool MakeDefault);

public record SetPhoneLineActiveRequest(bool IsActive);
