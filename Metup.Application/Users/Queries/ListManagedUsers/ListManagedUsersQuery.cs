using Metup.Application.Users.Common;
using MediatR;

namespace Metup.Application.Users.Queries.ListManagedUsers;

public record ListManagedUsersQuery : IRequest<IReadOnlyList<ManagedUserDto>>;
