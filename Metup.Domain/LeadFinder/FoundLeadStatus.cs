namespace Metup.Domain.LeadFinder;

/// <summary>Gravado como texto (nome do enum) — renomear um membro é migration.</summary>
public enum FoundLeadStatus
{
    /// <summary>Chegou da automação e ainda não foi triado.</summary>
    New,

    /// <summary>Virou empresa + negócio no funil.</summary>
    Imported,

    /// <summary>Fora do perfil. Continua na base para não voltar como "novo" em outra busca.</summary>
    Discarded,
}
