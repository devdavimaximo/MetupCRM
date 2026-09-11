namespace Metup.Application.Common.Exceptions;

/// <summary>
/// Lançada quando um caso de uso que precisa do autor da ação (ex.: quem mudou o estágio)
/// roda sem usuário resolvido no token. Na prática só acontece se um endpoint escapar do
/// [Authorize] — mesma rede de segurança de <see cref="MissingOrganizationScopeException"/>.
/// </summary>
public class MissingUserContextException() : Exception("Usuário não identificado para a requisição autenticada.");
