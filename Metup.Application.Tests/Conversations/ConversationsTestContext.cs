using Metup.Application.Tests.Dashboard;
using Metup.Application.Tests.Tasks;
using Metup.Domain.Contacts;
using Metup.Domain.Conversations;
using Metup.Domain.Users;
using Metup.Infrastructure.Persistence;

namespace Metup.Application.Tests.Conversations;

/// <summary>
/// Cenário das conversas sobre o contexto do dashboard (organização, "Empresa Alfa", Admin e SDR),
/// mais um contato com WhatsApp cadastrado — o que a ingestão resolve por telefone.
/// </summary>
public sealed class ConversationsTestContext : IDisposable
{
    public DashboardOverviewTestContext Base { get; } = new();

    public Guid ContactId { get; } = Guid.NewGuid();

    public const string ContactWhatsApp = "+55 11 91234-5678";

    public ConversationsTestContext()
    {
        Db.Contacts.Add(new Contact
        {
            Id = ContactId,
            OrganizationId = OrganizationId,
            CompanyId = Base.CompanyId,
            Name = "Bia Cliente",
            WhatsApp = ContactWhatsApp,
        });
        Db.SaveChanges();
    }

    public MetupDbContext Db => Base.Db;

    public Guid OrganizationId => Base.OrganizationId;

    public Guid AdminUserId => Base.AdminUserId;

    public Guid SdrUserId => Base.SdrUserId;

    public FakeCurrentUserService As(Guid userId, UserRole role) => Base.As(userId, role);

    public FakeServiceTokenUser AsServiceToken() => new(OrganizationId);

    public Conversation AddConversation(ConversationChannel channel = ConversationChannel.WhatsApp, string? externalId = null)
    {
        var conversation = Conversation.Create(OrganizationId, ContactId, channel, externalId);
        Db.Conversations.Add(conversation);
        Db.SaveChanges();
        return conversation;
    }

    public Message AddInbound(Guid conversationId, DateTime occurredAtUtc, string body = "oi") =>
        Persist(Message.ReceiveInbound(OrganizationId, conversationId, body, null, null, null, occurredAtUtc));

    public Message AddOutbound(Guid conversationId, Guid authorUserId, DateTime occurredAtUtc, string body = "olá") =>
        Persist(Message.SendOutbound(OrganizationId, conversationId, body, authorUserId, null, null, occurredAtUtc));

    private Message Persist(Message message)
    {
        Db.Messages.Add(message);
        Db.SaveChanges();
        return message;
    }

    public void Dispose() => Base.Dispose();
}
