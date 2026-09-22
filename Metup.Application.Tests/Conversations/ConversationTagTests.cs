using Metup.Application.Conversations.Commands.ApplyConversationTag;
using Metup.Application.Conversations.Commands.RemoveConversationTag;
using Metup.Application.Tests.Dashboard;
using Metup.Domain.Contacts;
using Metup.Domain.Conversations;
using Metup.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Metup.Application.Tests.Conversations;

public class ConversationTagTests
{
    [Fact]
    public async Task Aplicar_tag_nova_cria_no_catalogo_e_aplica()
    {
        using var context = new ConversationsTestContext();
        var conversation = context.AddConversation();

        await Handler(context).Handle(new ApplyConversationTagCommand(conversation.Id, "Alta intenção"), TestContext.Current.CancellationToken);

        Assert.Equal(1, await context.Db.ConversationTagOptions.CountAsync(TestContext.Current.CancellationToken));
        Assert.Equal(1, await context.Db.ConversationTags.CountAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task Aplicar_tag_existente_case_insensitive_nao_duplica_catalogo()
    {
        using var context = new ConversationsTestContext();
        var conversation = context.AddConversation();

        await Handler(context).Handle(new ApplyConversationTagCommand(conversation.Id, "Alta intenção"), TestContext.Current.CancellationToken);
        await Handler(context).Handle(new ApplyConversationTagCommand(conversation.Id, "alta intenção"), TestContext.Current.CancellationToken);

        Assert.Equal(1, await context.Db.ConversationTagOptions.CountAsync(TestContext.Current.CancellationToken));
        // Aplicar de novo (mesma tag resolvida) não duplica a junção.
        Assert.Equal(1, await context.Db.ConversationTags.CountAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task Segunda_conversa_reaproveita_a_mesma_tag_do_catalogo()
    {
        using var context = new ConversationsTestContext();
        var conversationA = context.AddConversation();

        // Segundo contato: o índice único é (organização, contato, canal) — precisa de outro
        // contato para uma segunda conversa no mesmo canal WhatsApp.
        var secondContactId = Guid.NewGuid();
        context.Db.Contacts.Add(new Contact
        {
            Id = secondContactId,
            OrganizationId = context.OrganizationId,
            CompanyId = context.Db.Companies.AsNoTracking().Select(c => c.Id).First(),
            Name = "Outro Contato",
            WhatsApp = "+55 11 98888-7777",
        });
        context.Db.SaveChanges();
        var conversationB = Conversation.Create(context.OrganizationId, secondContactId, ConversationChannel.WhatsApp);
        context.Db.Conversations.Add(conversationB);
        context.Db.SaveChanges();

        await Handler(context).Handle(new ApplyConversationTagCommand(conversationA.Id, "Orçamento"), TestContext.Current.CancellationToken);
        await Handler(context).Handle(new ApplyConversationTagCommand(conversationB.Id, "orçamento"), TestContext.Current.CancellationToken);

        Assert.Equal(1, await context.Db.ConversationTagOptions.CountAsync(TestContext.Current.CancellationToken));
        Assert.Equal(2, await context.Db.ConversationTags.CountAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task Remover_aplicacao_nao_apaga_o_catalogo()
    {
        using var context = new ConversationsTestContext();
        var conversation = context.AddConversation();
        await Handler(context).Handle(new ApplyConversationTagCommand(conversation.Id, "Orçamento"), TestContext.Current.CancellationToken);
        var tagOptionId = (await context.Db.ConversationTagOptions.AsNoTracking().SingleAsync(TestContext.Current.CancellationToken)).Id;

        await new RemoveConversationTagCommandHandler(context.Db, context.As(context.SdrUserId, UserRole.Sdr))
            .Handle(new RemoveConversationTagCommand(conversation.Id, tagOptionId), TestContext.Current.CancellationToken);

        Assert.Equal(0, await context.Db.ConversationTags.CountAsync(TestContext.Current.CancellationToken));
        Assert.Equal(1, await context.Db.ConversationTagOptions.CountAsync(TestContext.Current.CancellationToken));
    }

    private static ApplyConversationTagCommandHandler Handler(ConversationsTestContext context) =>
        new(context.Db, context.As(context.SdrUserId, UserRole.Sdr));
}
