namespace Metup.Domain.Deals;

/// <summary>Situação do negócio no funil — separada do estágio para filtrar "em aberto" sem casar com um Stage específico.</summary>
public enum DealStatus
{
    Aberto,
    Ganho,
    Perdido,
}
