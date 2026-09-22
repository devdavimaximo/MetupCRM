using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using Metup.Domain.Conversations;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Conversations.Commands.ApplyConversationTag;

/// <summary>
/// Se não existir tag com esse nome (case-insensitive) na organização, cria no catálogo; aplica na
/// conversa. Idempotente: tag já aplicada não duplica (item 6 do plano C1).
/// </summary>
public class ApplyConversationTagCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<ApplyConversationTagCommand>
{
    public async Task Handle(ApplyConversationTagCommand request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();

        var conversationExists = await context.Conversations
            .AnyAsync(c => c.Id == request.ConversationId && c.OrganizationId == organizationId, cancellationToken);
        if (!conversationExists)
        {
            throw new NotFoundException("Conversa");
        }

        var normalizedName = request.Name.Trim().ToLowerInvariant();

        var tagOption = await context.ConversationTagOptions
            .FirstOrDefaultAsync(t => t.OrganizationId == organizationId && t.NormalizedName == normalizedName, cancellationToken);

        if (tagOption is null)
        {
            tagOption = ConversationTagOption.Create(organizationId, request.Name);
            context.ConversationTagOptions.Add(tagOption);
        }

        var alreadyApplied = await context.ConversationTags
            .AnyAsync(t => t.ConversationId == request.ConversationId && t.TagOptionId == tagOption.Id, cancellationToken);

        if (!alreadyApplied)
        {
            context.ConversationTags.Add(new ConversationTag
            {
                OrganizationId = organizationId,
                ConversationId = request.ConversationId,
                TagOptionId = tagOption.Id,
            });
        }

        await context.SaveChangesAsync(cancellationToken);
    }
}
