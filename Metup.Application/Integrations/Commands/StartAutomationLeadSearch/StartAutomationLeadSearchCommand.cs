using FluentValidation;
using Metup.Application.Common.Extensions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Common.Realtime;
using Metup.Application.LeadFinder.Common;
using Metup.Domain.LeadFinder;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Integrations.Commands.StartAutomationLeadSearch;

/// <summary>
/// Ingestão (n8n → CRM): a automação avisa que começou uma busca disparada fora do CRM (ex.: pelo
/// chat do agente). Idempotente por <paramref name="ExternalId"/> — o n8n pode reenviar.
/// </summary>
/// <param name="ExternalId">Id estável da execução no n8n (ex.: <c>$execution.id</c>).</param>
public record StartAutomationLeadSearchCommand(string ExternalId, string Query, string? Location) : IRequest<LeadSearchDto>;

public class StartAutomationLeadSearchCommandValidator : AbstractValidator<StartAutomationLeadSearchCommand>
{
    public StartAutomationLeadSearchCommandValidator()
    {
        RuleFor(x => x.ExternalId).NotEmpty().MaximumLength(LeadSearch.ExternalIdMaxLength);
        RuleFor(x => x.Query).NotEmpty().WithMessage("Informe o nicho buscado.").MaximumLength(LeadSearch.QueryMaxLength);
        RuleFor(x => x.Location).MaximumLength(LeadSearch.LocationMaxLength);
    }
}

public class StartAutomationLeadSearchCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    IPublisher publisher) : IRequestHandler<StartAutomationLeadSearchCommand, LeadSearchDto>
{
    public async Task<LeadSearchDto> Handle(StartAutomationLeadSearchCommand request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();
        var nowUtc = DateTime.UtcNow;
        var externalId = request.ExternalId.Trim();

        var existing = await context.LeadSearches
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.OrganizationId == organizationId && s.ExternalId == externalId, cancellationToken);
        if (existing is not null)
        {
            return await existing.ToDtoAsync(context, nowUtc, cancellationToken);
        }

        var search = LeadSearch.StartFromAutomation(
            organizationId,
            request.Query.NormalizeRequired(),
            request.Location.NormalizeOptional(),
            externalId,
            nowUtc);
        context.LeadSearches.Add(search);

        await context.SaveChangesAsync(cancellationToken);
        await publisher.Publish(new LeadSearchUpdatedNotification(organizationId, search.Id), cancellationToken);

        return await search.ToDtoAsync(context, nowUtc, cancellationToken);
    }
}
