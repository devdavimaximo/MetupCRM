using FluentValidation;
using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Extensions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Common.Realtime;
using Metup.Application.LeadFinder.Common;
using Metup.Domain.LeadFinder;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Integrations.Commands.FinishLeadSearch;

/// <summary>
/// Ingestão (n8n → CRM): a automação avisa que terminou (ou falhou). Idempotente — repetir o fim não
/// muda nada. A mensagem de erro aparece para o SDR, então o n8n deve mandar algo legível, sem segredo.
/// </summary>
public record FinishLeadSearchCommand(Guid LeadSearchId, bool Success, string? ErrorMessage) : IRequest<LeadSearchDto>;

public class FinishLeadSearchCommandValidator : AbstractValidator<FinishLeadSearchCommand>
{
    public FinishLeadSearchCommandValidator()
    {
        RuleFor(x => x.LeadSearchId).NotEmpty();
    }
}

public class FinishLeadSearchCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    IPublisher publisher) : IRequestHandler<FinishLeadSearchCommand, LeadSearchDto>
{
    public async Task<LeadSearchDto> Handle(FinishLeadSearchCommand request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();
        var nowUtc = DateTime.UtcNow;

        var search = await context.LeadSearches
            .FirstOrDefaultAsync(s => s.Id == request.LeadSearchId && s.OrganizationId == organizationId, cancellationToken)
            ?? throw new NotFoundException("Busca");

        var error = request.ErrorMessage.NormalizeOptional() is { } message
            ? message.Length <= LeadSearch.ErrorMessageMaxLength ? message : message[..LeadSearch.ErrorMessageMaxLength]
            : "A automação não conseguiu concluir a busca.";

        search.Finish(request.Success, request.Success ? null : error, nowUtc);

        await context.SaveChangesAsync(cancellationToken);
        await publisher.Publish(new LeadSearchUpdatedNotification(organizationId, search.Id), cancellationToken);

        return await search.ToDtoAsync(context, nowUtc, cancellationToken);
    }
}
