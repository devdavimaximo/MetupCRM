namespace Metup.Application.Users.Common;

/// <summary>E-mail é a chave de login: gravado e comparado sem espaços e em minúsculas.</summary>
public static class UserEmail
{
    public static string Normalize(string email) => email.Trim().ToLowerInvariant();
}
