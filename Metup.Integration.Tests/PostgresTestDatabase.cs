using System.Text.Json;
using Metup.Application.Common.Interfaces;
using Metup.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Metup.Integration.Tests;

/// <summary>
/// Um banco Postgres <b>descartável</b> por classe de teste: nasce com nome único, recebe todas as
/// migrations (que ficam testadas de quebra) e é apagado no fim. Postgres real porque é onde relatório
/// erra — fuso, tradução de consulta, decimal — e o provedor em memória não reproduz nada disso.
///
/// Servidor: <c>METUP_TEST_POSTGRES</c> (connection string; o nome do banco é trocado) ou, em
/// desenvolvimento, a <c>DefaultConnection</c> de <c>Metup.Server/appsettings.Development.json</c>.
/// Sem servidor alcançável o teste é <b>pulado</b> com o motivo — exceto quando a variável foi
/// definida (CI), aí falha: silêncio não pode passar por sucesso.
/// </summary>
public sealed class PostgresTestDatabase : IAsyncDisposable
{
    private const string EnvironmentVariable = "METUP_TEST_POSTGRES";

    private readonly DbContextOptions<MetupDbContext> _options;

    private PostgresTestDatabase(string connectionString)
    {
        _options = new DbContextOptionsBuilder<MetupDbContext>().UseNpgsql(connectionString).Options;
    }

    /// <summary>Contexto preso a uma organização, como o de uma requisição.</summary>
    public MetupDbContext Open(Guid organizationId) => new(_options, new FixedTenantContext(organizationId));

    /// <summary>Contexto sem organização: só para gravar a massa e para criar/apagar o banco.</summary>
    public MetupDbContext OpenUnscoped() => new(_options, FixedTenantContext.None);

    /// <summary>Cria o banco e aplica as migrations. <c>null</c> + motivo quando não há servidor local.</summary>
    public static async Task<(PostgresTestDatabase? Database, string? UnavailableReason)> CreateAsync()
    {
        var (serverConnection, required) = ResolveServerConnection();
        if (serverConnection is null)
        {
            return (null, $"Sem Postgres configurado: defina {EnvironmentVariable} ou a DefaultConnection de desenvolvimento.");
        }

        var builder = new NpgsqlConnectionStringBuilder(serverConnection) { Database = "postgres" };
        try
        {
            await using var probe = new NpgsqlConnection(builder.ConnectionString);
            await probe.OpenAsync();
        }
        catch (Exception ex) when (!required && ex is NpgsqlException or System.Net.Sockets.SocketException or TimeoutException)
        {
            return (null, $"Postgres inalcançável em {builder.Host}:{builder.Port} ({ex.GetType().Name}).");
        }

        builder.Database = $"metup_it_{Guid.NewGuid():N}";
        var database = new PostgresTestDatabase(builder.ConnectionString);

        await using var context = database.OpenUnscoped();
        await context.Database.MigrateAsync();

        return (database, null);
    }

    public async ValueTask DisposeAsync()
    {
        await using var context = OpenUnscoped();
        await context.Database.EnsureDeletedAsync();
    }

    private static (string? ConnectionString, bool Required) ResolveServerConnection()
    {
        var fromEnvironment = Environment.GetEnvironmentVariable(EnvironmentVariable);
        if (!string.IsNullOrWhiteSpace(fromEnvironment))
        {
            return (fromEnvironment, true);
        }

        var settingsPath = Path.Combine(RepositoryRoot(), "Metup.Server", "appsettings.Development.json");
        if (!File.Exists(settingsPath))
        {
            return (null, false);
        }

        using var settings = JsonDocument.Parse(File.ReadAllText(settingsPath));
        var connection = settings.RootElement.TryGetProperty("ConnectionStrings", out var strings)
            && strings.TryGetProperty("DefaultConnection", out var value)
                ? value.GetString()
                : null;

        return (string.IsNullOrWhiteSpace(connection) ? null : connection, false);
    }

    private static string RepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "Metup.slnx")))
        {
            directory = directory.Parent;
        }

        return directory?.FullName ?? throw new InvalidOperationException("Raiz do repositório (Metup.slnx) não encontrada.");
    }
}

/// <summary>Usuário autenticado de mentira: organização, usuário e as permissões do cargo.</summary>
public sealed class FakeCurrentUser(Guid organizationId, Guid userId, IEnumerable<Domain.Users.Permission> permissions) : ICurrentUserService
{
    public Guid? UserId => userId;

    public Guid? OrganizationId => organizationId;

    public IReadOnlySet<Domain.Users.Permission> Permissions { get; } = permissions.ToHashSet();
}

/// <summary>Relógio congelado: o teste escolhe o "agora" e o fuso.</summary>
public sealed class FrozenOrganizationClock(TimeZoneInfo timeZone, DateTime utcNow) : IOrganizationClock
{
    public Task<Application.Common.Models.OrganizationClockSnapshot> SnapshotAsync(CancellationToken cancellationToken) =>
        Task.FromResult(new Application.Common.Models.OrganizationClockSnapshot(timeZone, utcNow));
}
