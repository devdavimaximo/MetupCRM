namespace Metup.Domain.Telephony;

/// <summary>
/// Por onde a chamada da linha sai. Gravado como texto (nome do enum) — renomear um membro é
/// migration; membros novos entram no fim.
/// </summary>
public enum PhoneLineKind
{
    /// <summary>
    /// Aparelho do usuário: o CRM abre um link <c>tel:</c> e o celular (ou o PC pareado a ele) liga
    /// pelo plano da operadora. Custo zero para o sistema; o CRM não sabe se atenderam nem a duração.
    /// </summary>
    Device,
}
