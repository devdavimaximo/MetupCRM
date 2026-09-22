using Metup.Application.Common.Realtime;
using Metup.Application.Conversations.Commands.FavoriteConversation;
using Metup.Application.Conversations.Commands.MarkConversationRead;
using Metup.Application.Conversations.Commands.MarkConversationUnread;
using Metup.Application.Conversations.Commands.UnfavoriteConversation;
using Metup.Application.Conversations.Common;
using Metup.Application.Conversations.Queries.ListConversations;
using Metup.Application.Tests.Dashboard;
using Metup.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Metup.Application.Tests.Conversations;

public class ConversationReadAndFavoriteTests
{
    private static readonly DateTime NowUtc = new(2026, 9, 22, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task Conversa_sem_registro_de_leitura_e_com_inbound_aparece_como_nao_lida()
    {
        using var context = new ConversationsTestContext();
        var conversation = context.AddConversation();
        context.AddInbound(conversation.Id, NowUtc);

        var item = await SingleListItem(context, context.SdrUserId);

        Assert.True(item.IsUnread);
    }

    [Fact]
    public async Task Marcar_como_lida_e_idempotente_e_zera_o_nao_lida()
    {
        using var context = new ConversationsTestContext();
        var conversation = context.AddConversation();
        context.AddInbound(conversation.Id, NowUtc);
        var clock = new FakeOrganizationClock(DashboardOverviewTestContext.SaoPaulo, NowUtc.AddMinutes(1));

        var handler = new MarkConversationReadCommandHandler(context.Db, context.As(context.SdrUserId, UserRole.Sdr), clock);
        await handler.Handle(new MarkConversationReadCommand(conversation.Id), TestContext.Current.CancellationToken);
        await handler.Handle(new MarkConversationReadCommand(conversation.Id), TestContext.Current.CancellationToken);

        Assert.Equal(1, await context.Db.ConversationReads.CountAsync(TestContext.Current.CancellationToken));
        Assert.False((await SingleListItem(context, context.SdrUserId)).IsUnread);
    }

    [Fact]
    public async Task Nova_mensagem_inbound_depois_da_leitura_volta_a_ficar_nao_lida()
    {
        using var context = new ConversationsTestContext();
        var conversation = context.AddConversation();
        context.AddInbound(conversation.Id, NowUtc);
        var clock = new FakeOrganizationClock(DashboardOverviewTestContext.SaoPaulo, NowUtc.AddMinutes(1));
        await new MarkConversationReadCommandHandler(context.Db, context.As(context.SdrUserId, UserRole.Sdr), clock)
            .Handle(new MarkConversationReadCommand(conversation.Id), TestContext.Current.CancellationToken);

        context.AddInbound(conversation.Id, NowUtc.AddMinutes(5));

        Assert.True((await SingleListItem(context, context.SdrUserId)).IsUnread);
    }

    [Fact]
    public async Task Leitura_e_por_usuario_nao_compartilhada()
    {
        using var context = new ConversationsTestContext();
        var conversation = context.AddConversation();
        context.AddInbound(conversation.Id, NowUtc);
        var clock = new FakeOrganizationClock(DashboardOverviewTestContext.SaoPaulo, NowUtc.AddMinutes(1));

        await new MarkConversationReadCommandHandler(context.Db, context.As(context.SdrUserId, UserRole.Sdr), clock)
            .Handle(new MarkConversationReadCommand(conversation.Id), TestContext.Current.CancellationToken);

        Assert.False((await SingleListItem(context, context.SdrUserId)).IsUnread);
        Assert.True((await SingleListItem(context, context.AdminUserId)).IsUnread);
    }

    [Fact]
    public async Task Marcar_como_nao_lida_apaga_o_cursor_e_e_idempotente()
    {
        using var context = new ConversationsTestContext();
        var conversation = context.AddConversation();
        context.AddInbound(conversation.Id, NowUtc);
        var clock = new FakeOrganizationClock(DashboardOverviewTestContext.SaoPaulo, NowUtc.AddMinutes(1));
        await new MarkConversationReadCommandHandler(context.Db, context.As(context.SdrUserId, UserRole.Sdr), clock)
            .Handle(new MarkConversationReadCommand(conversation.Id), TestContext.Current.CancellationToken);
        Assert.False((await SingleListItem(context, context.SdrUserId)).IsUnread);

        var handler = new MarkConversationUnreadCommandHandler(context.Db, context.As(context.SdrUserId, UserRole.Sdr));
        await handler.Handle(new MarkConversationUnreadCommand(conversation.Id), TestContext.Current.CancellationToken);
        await handler.Handle(new MarkConversationUnreadCommand(conversation.Id), TestContext.Current.CancellationToken);

        Assert.Equal(0, await context.Db.ConversationReads.CountAsync(TestContext.Current.CancellationToken));
        Assert.True((await SingleListItem(context, context.SdrUserId)).IsUnread);
    }

    [Fact]
    public async Task Marcar_como_nao_lida_sem_cursor_de_leitura_nao_e_erro()
    {
        using var context = new ConversationsTestContext();
        var conversation = context.AddConversation();

        var exception = await Record.ExceptionAsync(() =>
            new MarkConversationUnreadCommandHandler(context.Db, context.As(context.SdrUserId, UserRole.Sdr))
                .Handle(new MarkConversationUnreadCommand(conversation.Id), TestContext.Current.CancellationToken));

        Assert.Null(exception);
    }

    [Fact]
    public async Task Favoritar_duas_vezes_nao_duplica_e_so_publica_uma_vez()
    {
        using var context = new ConversationsTestContext();
        var conversation = context.AddConversation();
        var publisher = new RecordingPublisher();
        var handler = new FavoriteConversationCommandHandler(context.Db, context.As(context.SdrUserId, UserRole.Sdr), publisher);

        await handler.Handle(new FavoriteConversationCommand(conversation.Id), TestContext.Current.CancellationToken);
        await handler.Handle(new FavoriteConversationCommand(conversation.Id), TestContext.Current.CancellationToken);

        Assert.Equal(1, await context.Db.ConversationFavorites.CountAsync(TestContext.Current.CancellationToken));
        var notification = Assert.IsType<ConversationFavoritedNotification>(Assert.Single(publisher.Published));
        Assert.True(notification.UserScoped);
        Assert.Equal(context.SdrUserId, ((IRealtimeNotification)notification).OwnerUserId);
    }

    [Fact]
    public async Task Desfavoritar_sem_ter_favoritado_nao_e_erro()
    {
        using var context = new ConversationsTestContext();
        var conversation = context.AddConversation();

        var exception = await Record.ExceptionAsync(() =>
            new UnfavoriteConversationCommandHandler(context.Db, context.As(context.SdrUserId, UserRole.Sdr))
                .Handle(new UnfavoriteConversationCommand(conversation.Id), TestContext.Current.CancellationToken));

        Assert.Null(exception);
    }

    private static async Task<ConversationListItemDto> SingleListItem(ConversationsTestContext context, Guid userId)
    {
        var handler = new ListConversationsQueryHandler(context.Db, context.As(userId, UserRole.Sdr));
        var result = await handler.Handle(new ListConversationsQuery(), TestContext.Current.CancellationToken);
        return Assert.Single(result.Items);
    }
}
