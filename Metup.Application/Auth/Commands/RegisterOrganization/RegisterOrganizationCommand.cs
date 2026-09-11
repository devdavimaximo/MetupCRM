using Metup.Domain.Users;
using MediatR;

namespace Metup.Application.Auth.Commands.RegisterOrganization;

public record RegisterOrganizationCommand(
    string OrganizationName,
    string AdminName,
    string AdminEmail,
    string AdminPassword) : IRequest<RegisterOrganizationResult>;

public record RegisterOrganizationResult(
    Guid OrganizationId,
    Guid UserId,
    string Name,
    string Email,
    UserRole Role);
