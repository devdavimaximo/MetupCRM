namespace Metup.Application.Common.Interfaces;

/// <summary>
/// Diz se o cadastro público de organização segue aberto depois da primeira. Em produção fica
/// fechado: o endpoint só serve para criar a primeira organização (bootstrap) e os demais usuários
/// entram pela administração de usuários.
/// </summary>
public interface IRegistrationPolicy
{
    bool AllowsAdditionalOrganizations { get; }
}
