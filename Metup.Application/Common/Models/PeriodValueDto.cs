namespace Metup.Application.Common.Models;

/// <summary>
/// Um número do período e o mesmo número na janela imediatamente anterior, de mesmo tamanho — a
/// forma única de comparação temporal do produto, compartilhada entre dashboard e relatórios.
/// </summary>
public record PeriodValueDto(decimal Current, decimal Previous);
