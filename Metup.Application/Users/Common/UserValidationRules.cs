using FluentValidation;
using Metup.Domain.Users;

namespace Metup.Application.Users.Common;

/// <summary>Regras de campo de usuário e cargo, compartilhadas entre os comandos.</summary>
public static class UserValidationRules
{
    public const int PasswordMinLength = 8;
    public const int PasswordMaxLength = 128;

    public static IRuleBuilderOptions<T, string> ValidUserName<T>(this IRuleBuilder<T, string> rule) =>
        rule.NotEmpty().WithMessage("Informe o nome.")
            .MaximumLength(200).WithMessage("O nome deve ter no máximo 200 caracteres.");

    public static IRuleBuilderOptions<T, string> ValidUserEmail<T>(this IRuleBuilder<T, string> rule) =>
        rule.NotEmpty().WithMessage("Informe o e-mail.")
            .EmailAddress().WithMessage("E-mail inválido.")
            .MaximumLength(320).WithMessage("O e-mail deve ter no máximo 320 caracteres.");

    public static IRuleBuilderOptions<T, string> ValidPassword<T>(this IRuleBuilder<T, string> rule) =>
        rule.NotEmpty().WithMessage("Informe a senha.")
            .MinimumLength(PasswordMinLength).WithMessage($"A senha deve ter no mínimo {PasswordMinLength} caracteres.")
            .MaximumLength(PasswordMaxLength).WithMessage($"A senha deve ter no máximo {PasswordMaxLength} caracteres.");

    public static IRuleBuilderOptions<T, Guid> ValidRoleId<T>(this IRuleBuilder<T, Guid> rule) =>
        rule.NotEmpty().WithMessage("Escolha o cargo.");

    public static IRuleBuilderOptions<T, string> ValidRoleName<T>(this IRuleBuilder<T, string> rule) =>
        rule.NotEmpty().WithMessage("Informe o nome do cargo.")
            .MaximumLength(Role.NameMaxLength).WithMessage($"O nome deve ter no máximo {Role.NameMaxLength} caracteres.");

    public static IRuleBuilderOptions<T, string?> ValidRoleDescription<T>(this IRuleBuilder<T, string?> rule) =>
        rule.MaximumLength(Role.DescriptionMaxLength)
            .WithMessage($"A descrição deve ter no máximo {Role.DescriptionMaxLength} caracteres.");

    public static IRuleBuilderOptions<T, IReadOnlyList<Permission>> ValidPermissions<T>(
        this IRuleBuilder<T, IReadOnlyList<Permission>> rule) =>
        rule.NotNull().WithMessage("Informe as permissões.")
            .Must(p => p.All(Enum.IsDefined)).WithMessage("Permissão desconhecida.");
}
