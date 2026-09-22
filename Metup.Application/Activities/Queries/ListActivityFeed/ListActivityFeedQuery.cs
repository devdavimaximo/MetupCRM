using Metup.Application.Activities.Common;
using MediatR;

namespace Metup.Application.Activities.Queries.ListActivityFeed;

/// <summary>
/// O feed completo da operação, do mais recente para trás, independente do período do dashboard.
/// <c>OwnerUserId</c> filtra pelo responsável dos negócios; para quem só enxerga a própria carteira
/// (SDR) o pedido é ignorado e vale o escopo dele. <c>DealId</c>, quando presente, restringe a um
/// único negócio (painel de contexto das Conversas, item 20) e ignora o escopo por responsável —
/// acessar um negócio específico já é da organização inteira, como no Pipeline.
/// </summary>
public record ListActivityFeedQuery(
    string? Cursor = null,
    IReadOnlyList<ActivityFeedFilter>? Kinds = null,
    Guid? OwnerUserId = null,
    int PageSize = ListActivityFeedQuery.DefaultPageSize,
    Guid? DealId = null) : IRequest<ActivityFeedPageDto>
{
    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 50;
}
