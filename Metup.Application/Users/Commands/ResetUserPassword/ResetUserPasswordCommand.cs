using MediatR;

namespace Metup.Application.Users.Commands.ResetUserPassword;

/// <summary>O administrador define uma nova senha para o usuário (não há "esqueci a senha" por e-mail).</summary>
public record ResetUserPasswordCommand(Guid Id, string Password) : IRequest;
