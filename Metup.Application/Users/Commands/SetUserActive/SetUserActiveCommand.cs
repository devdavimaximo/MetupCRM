using Metup.Application.Users.Common;
using MediatR;

namespace Metup.Application.Users.Commands.SetUserActive;

/// <summary>
/// Desativar no lugar de excluir: o usuário é autor de atividades, mudanças de etapa e tarefas —
/// histórico comercial que não se perde (regra 4.6 do CLAUDE.md).
/// </summary>
public record SetUserActiveCommand(Guid Id, bool IsActive) : IRequest<ManagedUserDto>;
