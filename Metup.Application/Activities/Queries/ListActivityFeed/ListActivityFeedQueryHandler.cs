using Metup.Application.Activities.Common;
using Metup.Application.Common.Interfaces;
using MediatR;

namespace Metup.Application.Activities.Queries.ListActivityFeed;

public class ListActivityFeedQueryHandler(
    ICurrentUserService currentUserService,
    ActivityFeedReader feedReader) : IRequestHandler<ListActivityFeedQuery, ActivityFeedPageDto>
{
    public Task<ActivityFeedPageDto> Handle(ListActivityFeedQuery request, CancellationToken cancellationToken)
    {
        // Admin/Closer alcançam a organização e podem filtrar por responsável; o SDR fica na própria
        // carteira, e o reader usa o responsável do escopo acima de qualquer pedido.
        var scope = currentUserService.ResolveDealScope();
        ActivityFeedCursor? after = ActivityFeedCursor.TryDecode(request.Cursor, out var cursor) ? cursor : null;

        return feedReader.ReadAsync(
            scope,
            new ActivityFeedRequest(after, request.Kinds ?? [], request.OwnerUserId, request.PageSize),
            cancellationToken);
    }
}
