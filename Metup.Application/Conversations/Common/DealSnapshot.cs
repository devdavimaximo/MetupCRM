using Metup.Application.Common.Interfaces;
using Metup.Domain.Deals;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Conversations.Common;

/// <summary>
/// Resolve o negócio "atual" de um contato para gravar o snapshot histórico em
/// <c>Message.DealStageAtMessage</c> (seção 7 do CLAUDE.md) — o negócio aberto mais recente,
/// ou o mais recente encerrado se não houver nenhum aberto. Usado tanto pela ingestão (mensagem
/// inbound do n8n) quanto pelo envio pela inbox, para não duplicar a mesma query nos dois handlers.
/// </summary>
public static class DealSnapshot
{
    public static async Task<(Guid? DealId, DealStage? Stage)> ResolveForContactAsync(
        IApplicationDbContext context,
        Guid organizationId,
        Guid contactId,
        CancellationToken cancellationToken)
    {
        var deal = await context.Deals
            .AsNoTracking()
            .Where(d => d.OrganizationId == organizationId && d.ContactId == contactId)
            .OrderBy(d => d.Status == DealStatus.Aberto ? 0 : 1)
            .ThenByDescending(d => d.CreatedAt)
            .Select(d => new { d.Id, d.Stage })
            .FirstOrDefaultAsync(cancellationToken);

        return deal is null ? (null, null) : (deal.Id, deal.Stage);
    }
}
