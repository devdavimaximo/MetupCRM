using Metup.Application.Search.Common;
using Metup.Application.Search.Queries.GlobalSearch;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Metup.Server.Controllers;

/// <remarks>Busca global da paleta de comandos. Escopo por papel resolvido no caso de uso.</remarks>
[ApiController]
[Authorize]
[Route("api/search")]
public class SearchController(ISender sender) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<SearchResultDto>> Search([FromQuery] string? q, CancellationToken cancellationToken) =>
        Ok(await sender.Send(new SearchQuery(q ?? string.Empty), cancellationToken));
}
