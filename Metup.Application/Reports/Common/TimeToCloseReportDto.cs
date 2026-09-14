namespace Metup.Application.Reports.Common;

/// <summary>
/// Tempo ponta a ponta do funil (V3, quarta fatia — seção 7 do CLAUDE.md): dias entre
/// <c>Deal.CreatedAt</c> e <c>Deal.ClosedAt</c> nos negócios ganhos do período — diferente de
/// <see cref="StageDurationDto"/>, que mede tempo por estágio. Dias em <c>double</c>, não
/// <c>decimal</c>, porque não é dinheiro (regra 4.7 é sobre valores monetários).
/// </summary>
public record TimeToCloseReportDto(int WonDealsCount, double? AverageDaysToClose);
