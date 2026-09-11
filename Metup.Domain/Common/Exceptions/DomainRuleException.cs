namespace Metup.Domain.Common.Exceptions;

/// <summary>
/// Violação de uma regra de negócio garantida pelo próprio domínio (ex.: transição de
/// estágio inválida). Diferente de validação de entrada — isso é invariante de domínio.
/// </summary>
public class DomainRuleException(string message) : Exception(message);
