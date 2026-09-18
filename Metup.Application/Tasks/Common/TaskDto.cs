using Metup.Domain.Activities;
using Metup.Domain.Deals;
using Metup.Domain.Tasks;

namespace Metup.Application.Tasks.Common;

/// <summary>
/// Uma tarefa (próxima ação) sobre um negócio — o que alimenta o "hoje" do SDR. Os campos do
/// negócio no fim são o contexto comercial da linha da tabela de Tarefas; só se acrescenta campo
/// no fim (o dashboard e o registro de atividade consomem o mesmo DTO).
/// </summary>
/// <param name="DealAmount">
/// Negócio aberto: valor efetivo (<see cref="Deals.Common.DealValue"/>). Negócio fechado: o valor
/// fechado, sem cair para o ticket.
/// </param>
/// <param name="DealAmountIsEstimated">O valor veio do ticket estimado (só em negócio aberto).</param>
public record TaskDto(
    Guid Id,
    Guid DealId,
    Guid CompanyId,
    string CompanyName,
    ActivityType Type,
    DateTime DueDate,
    Guid OwnerUserId,
    string OwnerUserName,
    string? Note,
    TaskItemStatus Status,
    DateTime CreatedAt,
    DateTime? CompletedAt,
    DealStage DealStage,
    decimal? DealAmount,
    bool DealAmountIsEstimated,
    string? ContactName);
