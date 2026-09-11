using Metup.Application.Common.Interfaces;
using Metup.Domain.Companies;
using Metup.Domain.Contacts;
using Metup.Domain.Deals;
using Metup.Domain.Organizations;
using Metup.Domain.Users;
using Microsoft.EntityFrameworkCore;

namespace Metup.Infrastructure.Persistence;

public class MetupDbContext(DbContextOptions<MetupDbContext> options) : DbContext(options), IApplicationDbContext
{
    public DbSet<Organization> Organizations => Set<Organization>();

    public DbSet<User> Users => Set<User>();

    public DbSet<Company> Companies => Set<Company>();

    public DbSet<Contact> Contacts => Set<Contact>();

    public DbSet<Deal> Deals => Set<Deal>();

    public DbSet<StageChange> StageChanges => Set<StageChange>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(MetupDbContext).Assembly);
        base.OnModelCreating(modelBuilder);
    }
}
