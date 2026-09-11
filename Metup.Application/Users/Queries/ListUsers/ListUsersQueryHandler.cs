using Metup.Application.Common.Interfaces;
using Metup.Application.Users.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Users.Queries.ListUsers;

public class ListUsersQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<ListUsersQuery, IReadOnlyList<UserSummaryDto>>
{
    public async Task<IReadOnlyList<UserSummaryDto>> Handle(ListUsersQuery request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();

        return await context.Users
            .AsNoTracking()
            .Where(u => u.OrganizationId == organizationId)
            .OrderBy(u => u.Name)
            .Select(u => new UserSummaryDto(u.Id, u.Name, u.Role))
            .ToListAsync(cancellationToken);
    }
}
