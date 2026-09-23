using FluentValidation;
using Metup.Application.Auth.Commands.Login;
using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Roles.Commands.CreateRole;
using Metup.Application.Roles.Commands.DeleteRole;
using Metup.Application.Roles.Commands.UpdateRole;
using Metup.Application.Roles.Queries.ListRoles;
using Metup.Application.Users.Commands.CreateUser;
using Metup.Application.Users.Commands.ResetUserPassword;
using Metup.Application.Users.Commands.SetUserActive;
using Metup.Application.Users.Commands.UpdateUser;
using Metup.Domain.Common.Exceptions;
using Metup.Domain.Organizations;
using Metup.Domain.Users;
using Metup.Infrastructure.Persistence;
using Metup.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Metup.Application.Tests.Users;

/// <summary>Usuário logado com um conjunto arbitrário de permissões.</summary>
public sealed class FakePermissionUser(Guid organizationId, Guid userId, IEnumerable<Permission> permissions) : ICurrentUserService
{
    public Guid? UserId => userId;

    public Guid? OrganizationId => organizationId;

    public IReadOnlySet<Permission> Permissions { get; } = new HashSet<Permission>(permissions);
}

public sealed class FakeTokenService : ITokenService
{
    public (string Token, DateTime ExpiresAtUtc) GenerateToken(User user) => ("token", DateTime.UtcNow.AddHours(1));
}

/// <summary>Organização com os cargos padrão, um administrador e um SDR.</summary>
public sealed class UserManagementTestContext : IDisposable
{
    public MetupDbContext Db { get; }

    public PasswordHasher Hasher { get; } = new();

    public Guid OrganizationId { get; } = Guid.NewGuid();

    public Role AdminRole { get; }

    public Role CloserRole { get; }

    public Role SdrRole { get; }

    public User Admin { get; }

    public User Sdr { get; }

    public UserManagementTestContext()
    {
        Db = new MetupDbContext(new DbContextOptionsBuilder<MetupDbContext>()
            .UseInMemoryDatabase($"users-{Guid.NewGuid()}")
            .Options);

        Db.Organizations.Add(new Organization { Id = OrganizationId, Name = "Acme" });

        var roles = Role.CreateDefaults(OrganizationId);
        AdminRole = roles.Single(r => r.IsAdministrator);
        CloserRole = roles.Single(r => r.Name == "Closer");
        SdrRole = roles.Single(r => r.Name == "SDR");
        Db.Roles.AddRange(roles);

        Admin = NewUser("Ana Admin", "ana@acme.com", AdminRole);
        Sdr = NewUser("Sofia SDR", "sofia@acme.com", SdrRole);
        Db.SaveChanges();
    }

    public User NewUser(string name, string email, Role role)
    {
        var user = new User
        {
            OrganizationId = OrganizationId,
            Name = name,
            Email = email,
            PasswordHash = Hasher.Hash("senha-segura"),
            RoleId = role.Id,
        };
        Db.Users.Add(user);
        return user;
    }

    public ICurrentUserService AsAdmin() => new FakePermissionUser(OrganizationId, Admin.Id, Enum.GetValues<Permission>());

    public ICurrentUserService As(User user, params Permission[] permissions) =>
        new FakePermissionUser(OrganizationId, user.Id, permissions);

    public void Dispose() => Db.Dispose();
}

public class UserAndRoleManagementTests
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Admin_cria_usuario_com_email_e_senha_e_ele_consegue_entrar()
    {
        using var context = new UserManagementTestContext();
        var handler = new CreateUserCommandHandler(context.Db, context.AsAdmin(), context.Hasher);

        var created = await handler.Handle(
            new CreateUserCommand("  Bruno Lima ", " Bruno@Acme.com ", "senha-do-bruno", context.SdrRole.Id), Ct);

        Assert.Equal("Bruno Lima", created.Name);
        Assert.Equal("bruno@acme.com", created.Email);
        Assert.Equal("SDR", created.RoleName);
        Assert.True(created.IsActive);

        var login = await new LoginCommandHandler(context.Db, context.Hasher, new FakeTokenService())
            .Handle(new LoginCommand("BRUNO@acme.com", "senha-do-bruno"), Ct);

        Assert.Equal(created.Id, login.User.UserId);
        Assert.Equal(DefaultPermissions.Sdr.Order(), login.User.Permissions.Order());
    }

    [Fact]
    public async Task Email_repetido_e_recusado_sem_diferenciar_maiusculas()
    {
        using var context = new UserManagementTestContext();
        var handler = new CreateUserCommandHandler(context.Db, context.AsAdmin(), context.Hasher);

        await Assert.ThrowsAsync<ValidationException>(() =>
            handler.Handle(new CreateUserCommand("Outra Ana", "ANA@acme.com", "senha-segura", context.SdrRole.Id), Ct));
    }

    [Fact]
    public async Task Sem_permissao_de_usuarios_nao_cria_usuario()
    {
        using var context = new UserManagementTestContext();
        var handler = new CreateUserCommandHandler(context.Db, context.As(context.Sdr, [.. DefaultPermissions.Sdr]), context.Hasher);

        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            handler.Handle(new CreateUserCommand("Novo", "novo@acme.com", "senha-segura", context.SdrRole.Id), Ct));
    }

    [Fact]
    public async Task Quem_gerencia_usuarios_sem_ser_admin_nao_promove_ninguem_a_administrador()
    {
        using var context = new UserManagementTestContext();
        var manager = context.As(context.Sdr, [.. DefaultPermissions.Sdr, Permission.UsersManage]);

        var create = new CreateUserCommandHandler(context.Db, manager, context.Hasher);
        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            create.Handle(new CreateUserCommand("Novo", "novo@acme.com", "senha-segura", context.AdminRole.Id), Ct));

        var update = new UpdateUserCommandHandler(context.Db, manager);
        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            update.Handle(new UpdateUserCommand(context.Sdr.Id, context.Sdr.Name, context.Sdr.Email, context.AdminRole.Id), Ct));
    }

    [Fact]
    public async Task Quem_gerencia_usuarios_sem_ser_admin_nao_redefine_a_senha_do_admin()
    {
        using var context = new UserManagementTestContext();
        var manager = context.As(context.Sdr, [.. DefaultPermissions.Sdr, Permission.UsersManage]);
        var handler = new ResetUserPasswordCommandHandler(context.Db, manager, context.Hasher);

        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            handler.Handle(new ResetUserPasswordCommand(context.Admin.Id, "senha-nova-123"), Ct));
    }

    [Fact]
    public async Task Redefinir_senha_troca_a_senha_de_entrada()
    {
        using var context = new UserManagementTestContext();
        await new ResetUserPasswordCommandHandler(context.Db, context.AsAdmin(), context.Hasher)
            .Handle(new ResetUserPasswordCommand(context.Sdr.Id, "senha-nova-123"), Ct);

        var login = new LoginCommandHandler(context.Db, context.Hasher, new FakeTokenService());
        await Assert.ThrowsAsync<InvalidCredentialsException>(() => login.Handle(new LoginCommand("sofia@acme.com", "senha-segura"), Ct));
        Assert.Equal(context.Sdr.Id, (await login.Handle(new LoginCommand("sofia@acme.com", "senha-nova-123"), Ct)).User.UserId);
    }

    [Fact]
    public async Task Usuario_desativado_nao_entra()
    {
        using var context = new UserManagementTestContext();
        var result = await new SetUserActiveCommandHandler(context.Db, context.AsAdmin())
            .Handle(new SetUserActiveCommand(context.Sdr.Id, IsActive: false), Ct);

        Assert.False(result.IsActive);
        await Assert.ThrowsAsync<InvalidCredentialsException>(() =>
            new LoginCommandHandler(context.Db, context.Hasher, new FakeTokenService())
                .Handle(new LoginCommand("sofia@acme.com", "senha-segura"), Ct));
    }

    [Fact]
    public async Task Ninguem_desativa_o_proprio_usuario()
    {
        using var context = new UserManagementTestContext();

        await Assert.ThrowsAsync<DomainRuleException>(() =>
            new SetUserActiveCommandHandler(context.Db, context.AsAdmin())
                .Handle(new SetUserActiveCommand(context.Admin.Id, IsActive: false), Ct));
    }

    [Fact]
    public async Task A_organizacao_nao_fica_sem_administrador_ativo()
    {
        using var context = new UserManagementTestContext();
        var secondAdmin = context.NewUser("Beto Admin", "beto@acme.com", context.AdminRole);
        await context.Db.SaveChangesAsync(Ct);

        var update = new UpdateUserCommandHandler(context.Db, new FakePermissionUser(context.OrganizationId, secondAdmin.Id, Enum.GetValues<Permission>()));

        // Com outro admin ativo, rebaixar a Ana é permitido…
        await update.Handle(new UpdateUserCommand(context.Admin.Id, context.Admin.Name, context.Admin.Email, context.CloserRole.Id), Ct);

        // …mas o último admin não pode sair do cargo.
        await Assert.ThrowsAsync<DomainRuleException>(() =>
            update.Handle(new UpdateUserCommand(secondAdmin.Id, secondAdmin.Name, secondAdmin.Email, context.SdrRole.Id), Ct));
    }

    [Fact]
    public async Task Cargo_novo_libera_so_as_permissoes_marcadas()
    {
        using var context = new UserManagementTestContext();

        var role = await new CreateRoleCommandHandler(context.Db, context.AsAdmin()).Handle(
            new CreateRoleCommand("Financeiro", "  ", [Permission.ReportsView, Permission.DashboardView, Permission.ReportsView]), Ct);

        Assert.Null(role.Description);
        Assert.Equal([Permission.DashboardView, Permission.ReportsView], role.Permissions);

        var listed = await new ListRolesQueryHandler(context.Db, context.AsAdmin()).Handle(new ListRolesQuery(), Ct);
        Assert.Equal("Administrador", listed[0].Name);
        Assert.Contains(listed, r => r.Name == "Financeiro" && r.UserCount == 0);
        Assert.Equal(1, listed.Single(r => r.Name == "SDR").UserCount);
    }

    [Fact]
    public async Task Nome_de_cargo_repetido_e_recusado()
    {
        using var context = new UserManagementTestContext();

        await Assert.ThrowsAsync<ValidationException>(() =>
            new CreateRoleCommandHandler(context.Db, context.AsAdmin()).Handle(new CreateRoleCommand("sdr", null, []), Ct));
    }

    [Fact]
    public async Task Ninguem_concede_permissao_que_nao_tem()
    {
        using var context = new UserManagementTestContext();
        var roleManager = context.As(context.Sdr, [.. DefaultPermissions.Sdr, Permission.RolesManage]);

        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            new CreateRoleCommandHandler(context.Db, roleManager)
                .Handle(new CreateRoleCommand("Chefe", null, [Permission.SettingsManage]), Ct));

        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            new UpdateRoleCommandHandler(context.Db, roleManager)
                .Handle(new UpdateRoleCommand(context.SdrRole.Id, "SDR", null, [.. DefaultPermissions.Sdr, Permission.UsersManage]), Ct));
    }

    [Fact]
    public async Task Permissoes_do_administrador_nao_mudam()
    {
        using var context = new UserManagementTestContext();

        await Assert.ThrowsAsync<DomainRuleException>(() =>
            new UpdateRoleCommandHandler(context.Db, context.AsAdmin())
                .Handle(new UpdateRoleCommand(context.AdminRole.Id, "Administrador", null, [Permission.DashboardView]), Ct));
    }

    [Fact]
    public async Task Cargo_so_e_excluido_vazio_e_nunca_o_administrador()
    {
        using var context = new UserManagementTestContext();
        var handler = new DeleteRoleCommandHandler(context.Db, context.AsAdmin());

        await Assert.ThrowsAsync<DomainRuleException>(() => handler.Handle(new DeleteRoleCommand(context.SdrRole.Id), Ct));
        await Assert.ThrowsAsync<DomainRuleException>(() => handler.Handle(new DeleteRoleCommand(context.AdminRole.Id), Ct));

        await handler.Handle(new DeleteRoleCommand(context.CloserRole.Id), Ct);
        Assert.False(await context.Db.Roles.AnyAsync(r => r.Id == context.CloserRole.Id, Ct));
    }

    [Fact]
    public async Task Cargo_de_outra_organizacao_nao_e_encontrado()
    {
        using var context = new UserManagementTestContext();
        var foreignRole = Role.Create(Guid.NewGuid(), "Externo", null, []);
        context.Db.Roles.Add(foreignRole);
        await context.Db.SaveChangesAsync(Ct);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            new CreateUserCommandHandler(context.Db, context.AsAdmin(), context.Hasher)
                .Handle(new CreateUserCommand("Novo", "novo@acme.com", "senha-segura", foreignRole.Id), Ct));
    }
}
