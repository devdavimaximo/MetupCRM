namespace Metup.Application.Users.Common;

/// <summary>Linha enxuta de usuário ativo — para popular seletores (responsável do negócio, da tarefa).</summary>
public record UserSummaryDto(Guid Id, string Name);
