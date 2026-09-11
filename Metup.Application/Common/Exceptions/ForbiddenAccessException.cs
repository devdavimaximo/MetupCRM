namespace Metup.Application.Common.Exceptions;

/// <summary>Lançada quando o usuário autenticado não tem permissão para a ação pedida (ex.: SDR pedindo tarefas de outra pessoa).</summary>
public class ForbiddenAccessException(string message) : Exception(message);
