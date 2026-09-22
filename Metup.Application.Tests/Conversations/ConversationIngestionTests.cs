using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Realtime;
using Metup.Application.Integrations.Commands.ReceiveWhatsAppMessage;
using Metup.Application.Tests.Dashboard;
using Metup.Domain.Conversations;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Metup.Application.Tests.Conversations;

public class ConversationIngestionTests
{
    private static readonly DateTime NowUtc = new(2026, 9, 22, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task Primeira_mensagem_cria_conversa_no_canal_WhatsApp()
    {
        using var context = new ConversationsTestContext();

        await Handler(context, out _).Handle(
            new ReceiveWhatsAppMessageCommand(ConversationsTestContext.ContactWhatsApp, "oi", "ext-1", NowUtc),
            TestContext.Current.CancellationToken);

        var conversation = await context.Db.Conversations.AsNoTracking().SingleAsync(TestContext.Current.CancellationToken);
        Assert.Equal(ConversationChannel.WhatsApp, conversation.Channel);
        Assert.Equal(ConversationStatus.Aberta, conversation.Status);
    }

    [Fact]
    public async Task Sem_contato_correspondente_lanca_nao_encontrado()
    {
        using var context = new ConversationsTestContext();

        await Assert.ThrowsAsync<NotFoundException>(() => Handler(context, out _).Handle(
            new ReceiveWhatsAppMessageCommand("+55 11 90000-0000", "oi", null, NowUtc),
            TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task ExternalConversationId_resolve_a_conversa_antes_do_telefone()
    {
        using var context = new ConversationsTestContext();
        var conversation = context.AddConversation(externalId: "chatwoot-42");
        context.AddInbound(conversation.Id, NowUtc.AddMinutes(-10));

        // Telefone deliberadamente errado: só resolve porque o ExternalConversationId bate.
        await Handler(context, out _).Handle(
            new ReceiveWhatsAppMessageCommand("+55 11 90000-0000", "segunda mensagem", "ext-2", NowUtc, "chatwoot-42"),
            TestContext.Current.CancellationToken);

        Assert.Equal(1, await context.Db.Conversations.CountAsync(TestContext.Current.CancellationToken));
        var messageCount = await context.Db.Messages.CountAsync(m => m.ConversationId == conversation.Id, TestContext.Current.CancellationToken);
        Assert.Equal(2, messageCount);
    }

    [Fact]
    public async Task Sem_achar_o_ExternalConversationId_cai_para_telefone()
    {
        using var context = new ConversationsTestContext();

        await Handler(context, out _).Handle(
            new ReceiveWhatsAppMessageCommand(ConversationsTestContext.ContactWhatsApp, "oi", null, NowUtc, "chatwoot-inexistente"),
            TestContext.Current.CancellationToken);

        var conversation = await context.Db.Conversations.AsNoTracking().SingleAsync(TestContext.Current.CancellationToken);
        Assert.Equal(context.ContactId, conversation.ContactId);
        Assert.Equal("chatwoot-inexistente", conversation.ExternalId);
    }

    [Fact]
    public async Task Mensagem_inbound_reabre_conversa_resolvida()
    {
        using var context = new ConversationsTestContext();
        var conversation = context.AddConversation();
        conversation.Resolve();
        context.Db.SaveChanges();

        await Handler(context, out _).Handle(
            new ReceiveWhatsAppMessageCommand(ConversationsTestContext.ContactWhatsApp, "voltei", null, NowUtc),
            TestContext.Current.CancellationToken);

        var reloaded = await context.Db.Conversations.AsNoTracking().SingleAsync(TestContext.Current.CancellationToken);
        Assert.Equal(ConversationStatus.Aberta, reloaded.Status);
    }

    [Fact]
    public async Task ExternalMessageId_repetido_nao_duplica_e_devolve_a_mesma_mensagem()
    {
        using var context = new ConversationsTestContext();

        var first = await Handler(context, out _).Handle(
            new ReceiveWhatsAppMessageCommand(ConversationsTestContext.ContactWhatsApp, "oi", "dup-1", NowUtc),
            TestContext.Current.CancellationToken);
        var second = await Handler(context, out _).Handle(
            new ReceiveWhatsAppMessageCommand(ConversationsTestContext.ContactWhatsApp, "oi de novo", "dup-1", NowUtc),
            TestContext.Current.CancellationToken);

        Assert.Equal(first.Id, second.Id);
        Assert.Equal(1, await context.Db.Messages.CountAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task Mensagem_recebida_publica_aviso_de_tempo_real_para_a_organizacao()
    {
        using var context = new ConversationsTestContext();

        var message = await Handler(context, out var publisher).Handle(
            new ReceiveWhatsAppMessageCommand(ConversationsTestContext.ContactWhatsApp, "oi", null, NowUtc),
            TestContext.Current.CancellationToken);

        var notification = Assert.IsType<ConversationMessageReceivedNotification>(Assert.Single(publisher.Published));
        Assert.Equal(message.ConversationId, notification.ConversationId);
        Assert.False(notification.UserScoped);
    }

    private static ReceiveWhatsAppMessageCommandHandler Handler(ConversationsTestContext context, out RecordingPublisher publisher)
    {
        publisher = new RecordingPublisher();
        return new ReceiveWhatsAppMessageCommandHandler(context.Db, context.AsServiceToken(), publisher);
    }
}
