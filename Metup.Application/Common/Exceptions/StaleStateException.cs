namespace Metup.Application.Common.Exceptions;

/// <summary>
/// O client agiu sobre um estado que já não vale (outro usuário mudou antes). Vira 409 com o estado
/// atual no corpo (<c>current</c>), para a tela desfazer o que mostrou e avisar — sem nova ida ao servidor.
/// </summary>
public class StaleStateException(string message, object currentState) : Exception(message)
{
    public object CurrentState { get; } = currentState;
}
