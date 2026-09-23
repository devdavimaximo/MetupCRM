namespace Metup.Application.Reports.Common;

/// <summary>
/// A janela que o servidor de fato aplicou ao relatório, e a janela anterior de mesmo tamanho
/// usada como base de comparação. Vai em todo relatório porque o front não recorta período: ele
/// pede, o servidor decide e devolve o que valeu (mesmo contrato do dashboard).
///
/// <see cref="HistoryStart"/> é o primeiro <c>Deal.CreatedAt</c> da organização — antes dele não
/// existe base de comparação, e a UI diz isso em vez de inventar percentual.
/// <c>...Local</c> são datas no fuso da organização: o front rotula o intervalo com elas sem
/// reconverter fuso.
/// </summary>
public record ReportPeriodDto(
    int Days,
    DateTime PeriodStart,
    DateTime PeriodEnd,
    DateTime PreviousStart,
    DateOnly PeriodStartLocal,
    DateOnly PeriodEndLocal,
    DateTime? HistoryStart);
