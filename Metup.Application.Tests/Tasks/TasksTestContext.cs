using Metup.Application.Common.Interfaces;
using Metup.Application.Tests.Dashboard;
using Metup.Application.Tests.Search;
using Metup.Application.Tasks.Queries.GetTaskSummary;
using Metup.Application.Tasks.Queries.ListTasks;
using Metup.Domain.Activities;
using Metup.Domain.Deals;
using Metup.Domain.Tasks;
using Metup.Domain.Users;

namespace Metup.Application.Tests.Tasks;

/// <summary>Service token do n8n: organização sem usuário.</summary>
public sealed class FakeServiceTokenUser(Guid organizationId) : ICurrentUserService
{
    public Guid? UserId => null;

    public Guid? OrganizationId => organizationId;

    public string? Role => null;
}

/// <summary>
/// Cenário das tarefas sobre o contexto do dashboard (organização, "Empresa Alfa", Admin e SDR),
/// mais um Closer e um negócio aberto. Tarefas são montadas direto para o teste escolher
/// <c>CreatedAt</c> e o instante de conclusão.
/// </summary>
public sealed class TasksTestContext : IDisposable
{
    public DashboardOverviewTestContext Base { get; } = new();

    public Guid CloserUserId { get; } = Guid.NewGuid();

    public Deal Deal { get; }

    public TasksTestContext(DateTime nowUtc)
    {
        Db.Users.Add(new User
        {
            Id = CloserUserId,
            OrganizationId = OrganizationId,
            Name = "Carla Closer",
            Email = "carla@acme.com",
            PasswordHash = "x",
            Role = UserRole.Closer,
        });
        Db.SaveChanges();

        Deal = Base.AddOpenDeal(Base.SdrUserId, amount: null, ticket: 12_000m, nowUtc.AddDays(-60), DealStage.Proposta);
    }

    public Infrastructure.Persistence.MetupDbContext Db => Base.Db;

    public Guid OrganizationId => Base.OrganizationId;

    public Guid AdminUserId => Base.AdminUserId;

    public Guid SdrUserId => Base.SdrUserId;

    public TaskItem AddTask(
        DateTime dueUtc,
        Guid? ownerUserId = null,
        DateTime? createdAtUtc = null,
        DateTime? completedAtUtc = null,
        DateTime? cancelledAtUtc = null,
        string? note = null,
        ActivityType type = ActivityType.Call,
        Guid? dealId = null,
        Guid? organizationId = null)
    {
        var task = new TaskItem
        {
            OrganizationId = organizationId ?? OrganizationId,
            DealId = dealId ?? Deal.Id,
            Type = type,
            DueDate = dueUtc,
            OwnerUserId = ownerUserId ?? SdrUserId,
            Note = note,
            CreatedAt = createdAtUtc ?? dueUtc.AddDays(-20),
        };

        if (completedAtUtc is { } completedAt)
        {
            task.Complete(completedAt);
        }

        if (cancelledAtUtc is { } cancelledAt)
        {
            task.Cancel(cancelledAt);
        }

        Db.Tasks.Add(task);
        Db.SaveChanges();
        return task;
    }

    public void AddReschedule(TaskItem task, DateTime fromUtc, DateTime toUtc, DateTime atUtc)
    {
        Db.TaskReschedules.Add(new TaskReschedule
        {
            OrganizationId = OrganizationId,
            TaskId = task.Id,
            FromDueDate = fromUtc,
            ToDueDate = toUtc,
            RescheduledByUserId = task.OwnerUserId,
            RescheduledAt = atUtc,
        });
        Db.SaveChanges();
    }

    public ListTasksQueryHandler List(Guid userId, UserRole role, IOrganizationClock clock) =>
        new(Db, Base.As(userId, role), clock, new InMemoryTextSearch());

    public GetTaskSummaryQueryHandler Summary(Guid userId, UserRole role, IOrganizationClock clock) =>
        new(Db, Base.As(userId, role), clock);

    public void Dispose() => Base.Dispose();

    public static TimeZoneInfo Zone(string ianaId)
    {
        if (TimeZoneInfo.TryFindSystemTimeZoneById(ianaId, out var timeZone))
        {
            return timeZone;
        }

        return TimeZoneInfo.TryConvertIanaIdToWindowsId(ianaId, out var windowsId)
            ? TimeZoneInfo.FindSystemTimeZoneById(windowsId)
            : throw new InvalidOperationException($"Fuso {ianaId} indisponível nesta máquina.");
    }
}
