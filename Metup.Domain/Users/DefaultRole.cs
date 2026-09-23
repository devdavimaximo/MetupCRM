namespace Metup.Domain.Users;

/// <summary>
/// Os três cargos com que toda organização nasce (ver <see cref="Role.CreateDefaults"/>). Não é o
/// cargo do usuário — esse é <see cref="User.RoleId"/>; serve a seed, testes e migração dos
/// papéis fixos antigos.
/// </summary>
public enum DefaultRole
{
    Admin,
    Closer,
    Sdr,
}
