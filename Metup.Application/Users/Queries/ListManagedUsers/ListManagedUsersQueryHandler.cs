using Metup.Application.Common.Interfaces;
using Metup.Application.Users.Common;
using Metup.Domain.Users;
using MediatR;

namespace Metup.Application.Users.Queries.ListManagedUsers;

public class ListManagedUsersQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<ListManagedUsersQuery, IReadOnlyList<ManagedUserDto>>
{
    public async Task<IReadOnlyList<ManagedUserDto>> Handle(ListManagedUsersQuery request, CancellationToken cancellationToken)
    {
        currentUserService.RequirePermission(Permission.UsersManage);
        var organizationId = currentUserService.RequireOrganizationId();

        return await context.ListManagedUsersAsync(organizationId, userId: null, cancellationToken);
    }
}
