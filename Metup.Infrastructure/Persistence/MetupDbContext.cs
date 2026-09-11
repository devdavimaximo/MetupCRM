using Metup.Application.Common.Interfaces;
using Metup.Domain.Organizations;
using Metup.Domain.Users;
using Microsoft.EntityFrameworkCore;

namespace Metup.Infrastructure.Persistence;

public class MetupDbContext(DbContextOptions<MetupDbContext> options) : DbContext(options), IApplicationDbContext
{
    public DbSet<Organization> Organizations => Set<Organization>();

    public DbSet<User> Users => Set<User>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(MetupDbContext).Assembly);
        base.OnModelCreating(modelBuilder);
    }
}
