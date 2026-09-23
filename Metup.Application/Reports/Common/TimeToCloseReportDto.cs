namespace Metup.Application.Reports.Common;

/// <summary>
/// Tempo até fechamento como relatório próprio. A UI lê esse número dentro do funil (é lá que ele
/// ganha sentido, ao lado do tempo por estágio), mas o endpoint segue existindo isolado para quem
/// consome a API sem a tela — o n8n, por exemplo.
///
/// O conteúdo é o mesmo <see cref="TimeToCloseDto"/> do relatório de funil: uma definição só de
/// "quanto tempo leva para fechar", nunca duas que possam divergir.
/// </summary>
public record TimeToCloseReportDto(ReportPeriodDto Period, TimeToCloseDto TimeToClose);
