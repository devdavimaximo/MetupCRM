using Metup.Domain.Common;
using Metup.Domain.Common.Exceptions;

namespace Metup.Domain.Conversations;

/// <summary>
/// Catálogo de tags por organização — rótulo livre de classificação de conversa (mais parecido com
/// "label" do Chatwoot do que com um enum fechado de negócio como <c>LostReason</c>). Permite
/// autocompletar e evita duplicar variações do mesmo rótulo ("Alta intenção" × "alta intenção").
/// </summary>
public class ConversationTagOption : BaseEntity
{
    public const int NameMaxLength = 40;

    public string Name { get; private set; } = string.Empty;

    /// <summary>Forma normalizada (minúsculo, sem espaços nas pontas) usada para a unicidade case-insensitive.</summary>
    public string NormalizedName { get; private set; } = string.Empty;

    public static ConversationTagOption Create(Guid organizationId, string name)
    {
        var trimmed = name.Trim();
        if (string.IsNullOrWhiteSpace(trimmed))
        {
            throw new DomainRuleException("Toda tag precisa de um nome.");
        }

        return new ConversationTagOption
        {
            OrganizationId = organizationId,
            Name = trimmed,
            NormalizedName = trimmed.ToLowerInvariant(),
        };
    }
}
