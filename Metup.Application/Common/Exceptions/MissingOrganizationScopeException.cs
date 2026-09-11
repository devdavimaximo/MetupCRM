namespace Metup.Application.Common.Exceptions;

/// <summary>
/// Lançada quando um caso de uso escopado roda sem organização resolvida no token.
/// Na prática só acontece se um endpoint escapar do [Authorize] — é a rede de segurança da regra 4.1.
/// </summary>
public class MissingOrganizationScopeException() : Exception("Organização não identificada para o usuário autenticado.");
