using Metup.Application.Activities.Common;
using MediatR;

namespace Metup.Application.Activities.Queries.ListActivityFeed;

/// <summary>
/// O feed completo da operação, do mais recente para trás, independente do período do dashboard.
/// <c>OwnerUserId</c> filtra pelo responsável dos negócios; para quem só enxerga a própria carteira
/// (SDR) o pedido é ignorado e vale o escopo dele.
/// </summary>
public record ListActivityFeedQuery(
    string? Cursor = null,
    IReadOnlyList<ActivityFeedFilter>? Kinds = null,
    Guid? OwnerUserId = null,
    int PageSize = ListActivityFeedQuery.DefaultPageSize) : IRequest<ActivityFeedPageDto>
{
    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 50;
}
