using Microsoft.EntityFrameworkCore;

namespace Metup.Infrastructure.Persistence;

public class MetupDbContext(DbContextOptions<MetupDbContext> options) : DbContext(options)
{
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(MetupDbContext).Assembly);
        base.OnModelCreating(modelBuilder);
    }
}
