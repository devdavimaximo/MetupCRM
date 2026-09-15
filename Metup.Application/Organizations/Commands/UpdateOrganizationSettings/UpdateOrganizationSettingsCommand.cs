using Metup.Application.Organizations.Common;
using MediatR;

namespace Metup.Application.Organizations.Commands.UpdateOrganizationSettings;

/// <remarks>Sem OrganizationId: altera sempre a organização do usuário logado. Só Admin.</remarks>
public record UpdateOrganizationSettingsCommand(int StalledDealDays) : IRequest<OrganizationSettingsDto>;
