namespace Metup.Application.Common.Models;

/// <summary>Recorte de negócios que um caso de uso enxerga — pedido pelo client, decidido pelo servidor.</summary>
public enum DealScope
{
    /// <summary>Todos os negócios da organização.</summary>
    Organization,

    /// <summary>Somente os negócios em que o usuário atual é o responsável.</summary>
    Mine,
}

/// <summary>
/// Escopo já resolvido: organização e, quando o papel não alcança a organização inteira, o
/// responsável ao qual os dados ficam restritos. <see cref="AppliedScope"/> é o que de fato valeu —
/// um pedido não permitido é rebaixado em silêncio, nunca atendido.
/// </summary>
public readonly record struct DealScopeFilter(Guid OrganizationId, Guid? OwnerUserId, DealScope AppliedScope);
