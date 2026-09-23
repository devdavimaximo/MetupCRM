using Metup.Application.Users.Common;
using MediatR;

namespace Metup.Application.Users.Queries.GetCurrentUser;

public record GetCurrentUserQuery : IRequest<CurrentUserDto>;
