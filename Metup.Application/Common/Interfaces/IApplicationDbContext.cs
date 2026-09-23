using Metup.Domain.Activities;
using Metup.Domain.Companies;
using Metup.Domain.Contacts;
using Metup.Domain.Conversations;
using Metup.Domain.Deals;
using Metup.Domain.Integrations;
using Metup.Domain.Organizations;
using Metup.Domain.Tasks;
using Metup.Domain.Users;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Common.Interfaces;

public interface IApplicationDbContext
{
    DbSet<Organization> Organizations { get; }

    DbSet<User> Users { get; }

    DbSet<Role> Roles { get; }

    DbSet<Company> Companies { get; }

    DbSet<Contact> Contacts { get; }

    DbSet<Deal> Deals { get; }

    DbSet<StageChange> StageChanges { get; }

    DbSet<DealValueChange> DealValueChanges { get; }

    DbSet<Activity> Activities { get; }

    DbSet<TaskItem> Tasks { get; }

    DbSet<TaskReschedule> TaskReschedules { get; }

    DbSet<Conversation> Conversations { get; }

    DbSet<Message> Messages { get; }

    DbSet<MessageAttachment> MessageAttachments { get; }

    DbSet<ConversationRead> ConversationReads { get; }

    DbSet<ConversationFavorite> ConversationFavorites { get; }

    DbSet<ConversationTagOption> ConversationTagOptions { get; }

    DbSet<ConversationTag> ConversationTags { get; }

    DbSet<IntegrationEvent> IntegrationEvents { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
}
