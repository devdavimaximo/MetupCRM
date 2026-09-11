namespace Metup.Domain.Activities;

/// <summary>
/// Desfecho estruturado de uma atividade — pensado para Call, mas reutilizável por outros
/// tipos que fizerem sentido. Nunca texto livre (regra 4.3 e seção 7 do CLAUDE.md).
/// </summary>
public enum ActivityOutcome
{
    Atendeu,
    NaoAtendeu,
    NumeroInvalido,
    PediuRetorno,
    SemInteresse,
    Interessado,
    ReuniaoAgendada,
}
