using Metup.Application.Tasks.Commands.CreateTask;
using Metup.Application.Tasks.Common;
using Metup.Domain.Activities;
using Metup.Server.Security;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Metup.Server.Controllers;

/// <remarks>
/// Ingestão n8n → CRM (seção 5 do CLAUDE.md, roadmap V2): autenticada por service token da
/// organização — "a API de tarefas que o n8n usa" pra reagir a eventos do funil ("quando X então
/// Y") criando a próxima ação. A regra de cadência (quando disparar, qual tipo, qual prazo) mora
/// inteiramente no workflow do n8n; o CRM só valida o negócio e persiste.
///
/// Sem campo de idempotência (ex. ExternalRequestId): diferente da mensagem de WhatsApp — que
/// tem um id natural do provedor (ExternalMessageId) e pode legitimamente chegar duplicada por
/// reenvio da própria plataforma — uma tarefa de cadência não tem um "id externo" equivalente.
/// Se o n8n reenviar por timeout, reenviar cria uma segunda tarefa de fato distinguível (mesma
/// data/tipo, mas nada que amarre as duas como "a mesma tarefa"). Inventar uma chave sintética
/// (ex. hash de dealId+type+dueDate) daria falsos positivos: duas tarefas do mesmo tipo pro
/// mesmo negócio no mesmo dia são um cenário real de cadência, não duplicação. Fica para o
/// workflow do n8n evitar reenvio duplicado (idempotência do lado de quem dispara), não para o
/// CRM adivinhar identidade onde não existe uma.
/// </remarks>
[ApiController]
[Authorize(AuthenticationSchemes = ServiceTokenAuthenticationHandler.SchemeName)]
[Route("api/integrations/tasks")]
public class TaskIngestionController(ISender sender) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<TaskDto>> CreateTask(
        CreateTaskRequest request,
        CancellationToken cancellationToken)
    {
        var command = new CreateTaskCommand(
            request.DealId,
            request.Type,
            request.DueDate,
            request.Note);

        return Ok(await sender.Send(command, cancellationToken));
    }
}

public record CreateTaskRequest(
    Guid DealId,
    ActivityType Type,
    DateTime DueDate,
    string? Note);
