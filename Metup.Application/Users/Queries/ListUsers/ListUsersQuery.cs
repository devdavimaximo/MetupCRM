using Metup.Application.Users.Common;
using MediatR;

namespace Metup.Application.Users.Queries.ListUsers;

public record ListUsersQuery : IRequest<IReadOnlyList<UserSummaryDto>>;
