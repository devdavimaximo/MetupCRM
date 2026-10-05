using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using Metup.Application.LeadFinder.Common;
using Metup.Domain.Organizations;
using Metup.Domain.Users;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.LeadFinder.Commands.UpdateLeadFinderSettings;

/// <param name="WebhookUrl">Webhook do n8n que recebe os pedidos de busca. Vazio desliga a entrega imediata.</param>
public record UpdateLeadFinderSettingsCommand(string? WebhookUrl) : IRequest<LeadFinderSettingsDto>;

public record GetLeadFinderSettingsQuery : IRequest<LeadFinderSettingsDto>;

/// <summary>Conexão do buscador com a automação. Só com a permissão de configurações.</summary>
public class LeadFinderSettingsHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) :
    IRequestHandler<UpdateLeadFinderSettingsCommand, LeadFinderSettingsDto>,
    IRequestHandler<GetLeadFinderSettingsQuery, LeadFinderSettingsDto>
{
    public async Task<LeadFinderSettingsDto> Handle(UpdateLeadFinderSettingsCommand request, CancellationToken cancellationToken)
    {
        var organization = await LoadAsync(cancellationToken);
        organization.ChangeLeadSearchWebhookUrl(request.WebhookUrl);
        await context.SaveChangesAsync(cancellationToken);
        return ToDto(organization);
    }

    public async Task<LeadFinderSettingsDto> Handle(GetLeadFinderSettingsQuery request, CancellationToken cancellationToken) =>
        ToDto(await LoadAsync(cancellationToken));

    private async Task<Organization> LoadAsync(CancellationToken cancellationToken)
    {
        currentUserService.RequirePermission(Permission.SettingsManage);
        var organizationId = currentUserService.RequireOrganizationId();

        return await context.Organizations.FirstOrDefaultAsync(o => o.Id == organizationId, cancellationToken)
            ?? throw new NotFoundException("Organização");
    }

    private static LeadFinderSettingsDto ToDto(Organization organization) =>
        new(organization.LeadSearchWebhookUrl, organization.IntegrationTokenHash is not null);
}
