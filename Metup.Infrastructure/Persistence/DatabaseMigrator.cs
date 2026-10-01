using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Metup.Infrastructure.Persistence;

public static class DatabaseMigrator
{
    /// <summary>
    /// Aplica as migrations pendentes antes de a aplicação aceitar requisições. É o que permite
    /// subir uma versão nova na VPS sem rodar <c>dotnet ef</c> à mão.
    /// </summary>
    public static async Task MigrateDatabaseAsync(this IServiceProvider services, CancellationToken cancellationToken = default)
    {
        await using var scope = services.CreateAsyncScope();
        var context = scope.ServiceProvider.GetRequiredService<MetupDbContext>();
        await context.Database.MigrateAsync(cancellationToken);
    }
}
