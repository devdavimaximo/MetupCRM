namespace Metup.Application.Common.Exceptions;

/// <summary>
/// Recurso inexistente — ou fora da organização do usuário logado.
/// A mensagem é deliberadamente genérica para não vazar existência de dados de outra organização.
/// </summary>
public class NotFoundException(string resource) : Exception($"{resource} não encontrado(a).");
