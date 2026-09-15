using Metup.Application.Activities.Common;
using Metup.Application.Activities.Queries.ListActivityFeed;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Metup.Server.Controllers;

/// <remarks>
/// Feed da operação (atividades + transições de estágio), paginado por cursor. O escopo por papel é
/// resolvido no caso de uso. <c>kinds</c> aceita valores separados por vírgula
/// (<c>kinds=DealWon,Call</c>) ou repetidos (<c>kinds=DealWon&amp;kinds=Call</c>).
/// </remarks>
[ApiController]
[Authorize]
[Route("api/activity-feed")]
public class ActivityFeedController(ISender sender) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ActivityFeedPageDto>> List(
        [FromQuery] string? cursor,
        [FromQuery] string[]? kinds,
        [FromQuery] Guid? ownerUserId,
        [FromQuery] int pageSize = ListActivityFeedQuery.DefaultPageSize,
        CancellationToken cancellationToken = default)
    {
        var parsedKinds = new List<ActivityFeedFilter>();
        foreach (var kind in (kinds ?? []).SelectMany(k => k.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)))
        {
            if (!Enum.TryParse<ActivityFeedFilter>(kind, ignoreCase: true, out var parsed) || !Enum.IsDefined(parsed))
            {
                ModelState.AddModelError(nameof(kinds), $"Tipo de evento inválido: {kind}.");
                return ValidationProblem(ModelState);
            }

            parsedKinds.Add(parsed);
        }

        var query = new ListActivityFeedQuery(cursor, parsedKinds, ownerUserId, pageSize);
        return Ok(await sender.Send(query, cancellationToken));
    }
}
