using Metup.Domain.Activities;
using Metup.Domain.Deals;

namespace Metup.Application.Deals.Common;

/// <summary>Próxima ação pendente do negócio (a de prazo mais próximo).</summary>
public record DealBoardNextTaskDto(ActivityType Type, DateTime DueDate, bool IsOverdue);

/// <summary>
/// Cartão do quadro. <c>Value</c> segue <see cref="DealValue.ForStatus"/> (aberto = valor efetivo,
/// "est." quando veio do ticket; fechado = só o valor fechado). <c>StageEnteredAt</c> é a última
/// transição (o <c>CreatedAt</c> na falta dela); <c>DaysInStage</c>/<c>IsStalled</c> seguem
/// <c>StalledDealRule</c> com o limite da organização e só marcam parado o negócio aberto.
/// <c>LastActivityAt</c> é nulo sem atividade — o "há Xh" do cartão cai em <c>StageEnteredAt</c>.
/// </summary>
public record DealBoardCardDto(
    Guid Id,
    Guid CompanyId,
    string CompanyName,
    string? CompanySegment,
    string? ContactName,
    DealStage Stage,
    DealStatus Status,
    DealSource Source,
    Guid OwnerUserId,
    string OwnerUserName,
    decimal? Value,
    bool ValueIsEstimated,
    DateTime StageEnteredAt,
    int DaysInStage,
    bool IsStalled,
    DateTime? LastActivityAt,
    DealBoardNextTaskDto? NextTask,
    DateOnly? ExpectedCloseDate,
    DateTime? ClosedAt,
    LostReason? LostReason);

/// <summary>
/// Uma coluna do quadro (ou um sub-grupo de Fechados, com <c>Stage</c> = Ganho/Perdido). <c>Count</c>
/// e <c>Total</c> somam a coluna inteira no banco, não só a amostra; <c>Items</c> é a página
/// <c>Page</c>, e <c>HasMore</c> diz se há outra.
/// </summary>
public record DealBoardColumnDto(
    DealStage Stage,
    int Count,
    decimal Total,
    bool TotalHasEstimate,
    int Page,
    IReadOnlyList<DealBoardCardDto> Items,
    bool HasMore);

public record DealBoardClosedDto(DealBoardColumnDto Won, DealBoardColumnDto Lost);

/// <summary>
/// O quadro: as sete etapas ativas (fotografia do agora, ignoram o período) e Fechados (ganhos e
/// perdidos com <c>ClosedAt</c> no período). <c>OwnerUserId</c> é o responsável que valeu (nulo =
/// todos); o período vem em datas locais da organização.
/// </summary>
public record DealBoardDto(
    Guid? OwnerUserId,
    DateOnly PeriodStartLocal,
    DateOnly PeriodEndLocal,
    DealBoardSort Sort,
    IReadOnlyList<DealBoardColumnDto> Columns,
    DealBoardClosedDto Closed);
