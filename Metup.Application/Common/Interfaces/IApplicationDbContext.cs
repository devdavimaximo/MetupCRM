using Metup.Domain.Activities;
using Metup.Domain.Companies;
using Metup.Domain.Contacts;
using Metup.Domain.Deals;
using Metup.Domain.Organizations;
using Metup.Domain.Tasks;
using Metup.Domain.Users;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Common.Interfaces;

public interface IApplicationDbContext
{
    DbSet<Organization> Organizations { get; }

    DbSet<User> Users { get; }

    DbSet<Company> Companies { get; }

    DbSet<Contact> Contacts { get; }

    DbSet<Deal> Deals { get; }

    DbSet<StageChange> StageChanges { get; }

    DbSet<Activity> Activities { get; }

    DbSet<TaskItem> Tasks { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
}
