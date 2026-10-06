using Metup.Domain.Common;
using Metup.Domain.Common.Exceptions;

namespace Metup.Domain.Telephony;

/// <summary>
/// O número de onde um usuário liga. Cada login tem as suas linhas — é o que separa as ligações por
/// SDR: a ligação registrada guarda a linha usada, e um mesmo número ativo não pode estar com duas
/// pessoas da organização (a regra é do caso de uso, que enxerga as outras linhas). Cada usuário tem
/// no máximo uma linha principal, a que o discador escolhe sozinho.
///
/// Linhas não são excluídas: desativar preserva o histórico das ligações feitas por ela.
/// </summary>
public class PhoneLine : BaseEntity
{
    public const int LabelMaxLength = 60;
    public const int NumberMaxLength = 30;
    public const int NumberE164MaxLength = 16;

    public Guid UserId { get; private set; }

    public PhoneLineKind Kind { get; private set; }

    /// <summary>Apelido exibido no discador (ex.: "Celular comercial").</summary>
    public string Label { get; private set; } = string.Empty;

    /// <summary>O número como foi digitado — exibição.</summary>
    public string Number { get; private set; } = string.Empty;

    /// <summary>O mesmo número normalizado (+55 DDD número) — unicidade e comparação.</summary>
    public string NumberE164 { get; private set; } = string.Empty;

    public bool IsDefault { get; private set; }

    public bool IsActive { get; private set; } = true;

    public Guid CreatedByUserId { get; init; }

    public DateTime CreatedAt { get; init; }

    public static PhoneLine Create(
        Guid organizationId,
        Guid userId,
        PhoneLineKind kind,
        string label,
        string number,
        string numberE164,
        bool isDefault,
        Guid createdByUserId,
        DateTime nowUtc)
    {
        EnsureE164(numberE164);

        return new PhoneLine
        {
            OrganizationId = organizationId,
            UserId = userId,
            Kind = kind,
            Label = label,
            Number = number,
            NumberE164 = numberE164,
            IsDefault = isDefault,
            CreatedByUserId = createdByUserId,
            CreatedAt = nowUtc,
        };
    }

    public void Update(string label, string number, string numberE164)
    {
        EnsureE164(numberE164);

        Label = label;
        Number = number;
        NumberE164 = numberE164;
    }

    public void MakeDefault()
    {
        if (!IsActive)
        {
            throw new DomainRuleException("Uma linha desativada não pode ser a principal.");
        }

        IsDefault = true;
    }

    public void ClearDefault() => IsDefault = false;

    /// <summary>Desativada deixa de ser a principal — quem chama escolhe a próxima.</summary>
    public void Deactivate()
    {
        IsActive = false;
        IsDefault = false;
    }

    public void Reactivate() => IsActive = true;

    private static void EnsureE164(string numberE164)
    {
        if (numberE164.Length is < 12 or > NumberE164MaxLength || numberE164[0] != '+' || !numberE164[1..].All(char.IsAsciiDigit))
        {
            throw new DomainRuleException("Número da linha inválido.");
        }
    }
}
