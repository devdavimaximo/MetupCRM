using Metup.Application.Common.Exceptions;
using Metup.Application.Conversations.Commands.SetConversationAutomation;
using Metup.Application.Integrations.Commands.ReceiveAutomatedOutboundMessage;
using Metup.Application.Integrations.Common;
using Metup.Application.Tests.Dashboard;
using Metup.Domain.Conversations;
using Metup.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Metup.Application.Tests.Conversations;

public class AutomatedOutboundMessageTests
{
    private static readonly DateTime NowUtc = new(2026, 9, 22, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task Registra_mensagem_com_AuthorKind_Bot_e_sem_autor_humano()
    {
        using var context = new ConversationsTestContext();

        var message = await Handler(context, out _).Handle(
            new ReceiveAutomatedOutboundMessageCommand(ConversationsTestContext.ContactWhatsApp, "Já te ajudo!", "bot-1", NowUtc),
            TestContext.Current.CancellationToken);

        Assert.Equal(MessageAuthorKind.Bot, message.AuthorKind);
        Assert.Null(message.AuthorUserId);
        Assert.Equal(MessageDirection.Outbound, message.Direction);
    }

    [Fact]
    public async Task Sem_contato_correspondente_lanca_nao_encontrado()
    {
        using var context = new ConversationsTestContext();

        await Assert.ThrowsAsync<NotFoundException>(() => Handler(context, out _).Handle(
            new ReceiveAutomatedOutboundMessageCommand("+55 11 90000-0000", "oi", null, NowUtc),
            TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task ExternalMessageId_repetido_e_idempotente()
    {
        using var context = new ConversationsTestContext();

        var first = await Handler(context, out _).Handle(
            new ReceiveAutomatedOutboundMessageCommand(ConversationsTestContext.ContactWhatsApp, "oi", "bot-dup", NowUtc),
            TestContext.Current.CancellationToken);
        var second = await Handler(context, out _).Handle(
            new ReceiveAutomatedOutboundMessageCommand(ConversationsTestContext.ContactWhatsApp, "oi de novo", "bot-dup", NowUtc),
            TestContext.Current.CancellationToken);

        Assert.Equal(first.Id, second.Id);
        Assert.Equal(1, await context.Db.Messages.CountAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task Reabre_conversa_resolvida()
    {
        using var context = new ConversationsTestContext();
        var conversation = context.AddConversation();
        conversation.Resolve();
        context.Db.SaveChanges();

        await Handler(context, out _).Handle(
            new ReceiveAutomatedOutboundMessageCommand(ConversationsTestContext.ContactWhatsApp, "voltei", null, NowUtc),
            TestContext.Current.CancellationToken);

        var reloaded = await context.Db.Conversations.AsNoTracking().SingleAsync(TestContext.Current.CancellationToken);
        Assert.Equal(ConversationStatus.Aberta, reloaded.Status);
    }

    [Fact]
    public async Task Anexo_e_gravado_e_aparece_no_MessageDto()
    {
        using var context = new ConversationsTestContext();
        var attachments = new[] { new InboundAttachmentInput(MessageAttachmentKind.Document, "https://cdn.example.com/proposta.pdf", "proposta.pdf", "application/pdf", 1024) };

        var message = await Handler(context, out _).Handle(
            new ReceiveAutomatedOutboundMessageCommand(ConversationsTestContext.ContactWhatsApp, "segue o anexo", "bot-att", NowUtc, attachments),
            TestContext.Current.CancellationToken);

        var attachment = Assert.Single(message.Attachments);
        Assert.Equal("https://cdn.example.com/proposta.pdf", attachment.Url);
        Assert.Equal(MessageAttachmentKind.Document, attachment.Kind);
    }

    [Theory]
    [InlineData("nao-e-uma-url", false)]
    [InlineData("/relativo/sem/host", false)]
    [InlineData("https://cdn.example.com/arquivo.jpg", true)]
    public async Task Validador_recusa_URL_de_anexo_nao_absoluta(string url, bool valid)
    {
        var command = new ReceiveAutomatedOutboundMessageCommand(
            ConversationsTestContext.ContactWhatsApp,
            "oi",
            null,
            NowUtc,
            [new InboundAttachmentInput(MessageAttachmentKind.Image, url, null, null, null)]);

        var result = await new ReceiveAutomatedOutboundMessageCommandValidator().ValidateAsync(command, TestContext.Current.CancellationToken);

        Assert.Equal(valid, result.IsValid);
    }

    [Fact]
    public async Task Toggle_de_automacao_liga_e_desliga()
    {
        using var context = new ConversationsTestContext();
        var conversation = context.AddConversation();

        await new SetConversationAutomationCommandHandler(context.Db, context.As(context.SdrUserId, UserRole.Sdr))
            .Handle(new SetConversationAutomationCommand(conversation.Id, true), TestContext.Current.CancellationToken);

        Assert.True((await context.Db.Conversations.AsNoTracking().SingleAsync(TestContext.Current.CancellationToken)).AutomationEnabled);

        await new SetConversationAutomationCommandHandler(context.Db, context.As(context.SdrUserId, UserRole.Sdr))
            .Handle(new SetConversationAutomationCommand(conversation.Id, false), TestContext.Current.CancellationToken);

        Assert.False((await context.Db.Conversations.AsNoTracking().SingleAsync(TestContext.Current.CancellationToken)).AutomationEnabled);
    }

    private static ReceiveAutomatedOutboundMessageCommandHandler Handler(ConversationsTestContext context, out RecordingPublisher publisher)
    {
        publisher = new RecordingPublisher();
        return new ReceiveAutomatedOutboundMessageCommandHandler(context.Db, context.AsServiceToken(), publisher);
    }
}
