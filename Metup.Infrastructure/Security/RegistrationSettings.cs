using Metup.Application.Common.Interfaces;
using Microsoft.Extensions.Options;

namespace Metup.Infrastructure.Security;

public class RegistrationSettings
{
    public const string SectionName = "Registration";

    /// <summary>Falso por padrão: fora do desenvolvimento, o cadastro público só cria a primeira organização.</summary>
    public bool AllowAdditionalOrganizations { get; init; }
}

public class RegistrationPolicy(IOptions<RegistrationSettings> options) : IRegistrationPolicy
{
    public bool AllowsAdditionalOrganizations => options.Value.AllowAdditionalOrganizations;
}
