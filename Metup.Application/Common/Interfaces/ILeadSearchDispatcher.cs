namespace Metup.Application.Common.Interfaces;

/// <summary>
/// Entrega imediata de um pedido de busca de leads ao webhook do n8n, fora da requisição (job em
/// background com novas tentativas). O pedido já está gravado na fila <c>IntegrationEvent</c> antes
/// disso: sem webhook configurado ou com o n8n fora do ar, nada se perde — o n8n ainda pode consultar
/// a fila. O CRM continua funcionando sem a automação (seção 5 do CLAUDE.md).
/// </summary>
public interface ILeadSearchDispatcher
{
    /// <summary>Chamar depois do <c>SaveChangesAsync</c> que gravou o evento.</summary>
    void Dispatch(Guid organizationId, Guid integrationEventId);
}
