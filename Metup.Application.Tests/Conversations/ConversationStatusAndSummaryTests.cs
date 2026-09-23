using Metup.Application.Common.Realtime;
using Metup.Application.Conversations.Commands.FavoriteConversation;
using Metup.Application.Conversations.Commands.MarkConversationRead;
using Metup.Application.Conversations.Commands.UpdateConversationStatus;
using Metup.Application.Conversations.Queries.GetConversationContext;
using Metup.Application.Conversations.Queries.GetConversationsSummary;
using Metup.Application.Tests.Dashboard;
using Metup.Domain.Conversations;
using Metup.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Metup.Application.Tests.Conversations;

public class ConversationStatusAndSummaryTests
{
    private static readonly DateTime NowUtc = new(2026, 9, 22, 12, 0, 0, DateTimeKind.Utc);

    [Theory]
    [InlineData(ConversationStatus.Pendente)]
    [InlineData(ConversationStatus.Resolvida)]
    [InlineData(ConversationStatus.Aberta)]
    public async Task PUT_status_move_para_qualquer_um_dos_tres_valores(ConversationStatus target)
    {
        using var context = new ConversationsTestContext();
        var conversation = context.AddConversation();
        var publisher = new RecordingPublisher();

        await new UpdateConversationStatusCommandHandler(context.Db, context.As(context.SdrUserId, DefaultRole.Sdr), publisher)
            .Handle(new UpdateConversationStatusCommand(conversation.Id, target), TestContext.Current.CancellationToken);

        Assert.Equal(target, (await context.Db.Conversations.AsNoTracking().SingleAsync(TestContext.Current.CancellationToken)).Status);
        var notification = Assert.IsType<ConversationStatusChangedNotification>(Assert.Single(publisher.Published));
        Assert.False(notification.UserScoped);
    }

    [Fact]
    public async Task Resumo_bate_com_nao_lidas_e_favoritas_da_listagem()
    {
        using var context = new ConversationsTestContext();
        var conversation = context.AddConversation();
        context.AddInbound(conversation.Id, NowUtc);
        await new FavoriteConversationCommandHandler(context.Db, context.As(context.SdrUserId, DefaultRole.Sdr), new RecordingPublisher())
            .Handle(new FavoriteConversationCommand(conversation.Id), TestContext.Current.CancellationToken);

        var summary = await new GetConversationsSummaryQueryHandler(context.Db, context.As(context.SdrUserId, DefaultRole.Sdr))
            .Handle(new GetConversationsSummaryQuery(), TestContext.Current.CancellationToken);

        Assert.Equal(1, summary.Total);
        Assert.Equal(1, summary.Unread);
        Assert.Equal(1, summary.Favorite);
    }

    [Fact]
    public async Task Resumo_zera_nao_lidas_depois_de_marcar_como_lida()
    {
        using var context = new ConversationsTestContext();
        var conversation = context.AddConversation();
        context.AddInbound(conversation.Id, NowUtc);
        var clock = new FakeOrganizationClock(DashboardOverviewTestContext.SaoPaulo, NowUtc.AddMinutes(1));
        await new MarkConversationReadCommandHandler(context.Db, context.As(context.SdrUserId, DefaultRole.Sdr), clock)
            .Handle(new MarkConversationReadCommand(conversation.Id), TestContext.Current.CancellationToken);

        var summary = await new GetConversationsSummaryQueryHandler(context.Db, context.As(context.SdrUserId, DefaultRole.Sdr))
            .Handle(new GetConversationsSummaryQuery(), TestContext.Current.CancellationToken);

        Assert.Equal(0, summary.Unread);
    }

    [Fact]
    public async Task Contexto_sem_mensagens_tem_media_de_resposta_nula()
    {
        using var context = new ConversationsTestContext();
        var conversation = context.AddConversation();

        var dto = await new GetConversationContextQueryHandler(context.Db, context.As(context.SdrUserId, DefaultRole.Sdr))
            .Handle(new GetConversationContextQuery(conversation.Id), TestContext.Current.CancellationToken);

        Assert.Equal(0, dto.Summary.TotalMessages);
        Assert.Null(dto.Summary.AverageResponseTimeMinutes);
    }

    [Fact]
    public async Task Media_de_resposta_pareia_cada_inbound_com_a_proxima_outbound()
    {
        using var context = new ConversationsTestContext();
        var conversation = context.AddConversation();
        // Duas inbound seguidas (t0, t0+2min) respondidas juntas em t0+10min: espera de 10 e 8 min → média 9.
        context.AddInbound(conversation.Id, NowUtc);
        context.AddInbound(conversation.Id, NowUtc.AddMinutes(2));
        context.AddOutbound(conversation.Id, context.SdrUserId, NowUtc.AddMinutes(10));

        var dto = await new GetConversationContextQueryHandler(context.Db, context.As(context.SdrUserId, DefaultRole.Sdr))
            .Handle(new GetConversationContextQuery(conversation.Id), TestContext.Current.CancellationToken);

        Assert.Equal(3, dto.Summary.TotalMessages);
        Assert.Equal(9, dto.Summary.AverageResponseTimeMinutes);
    }

    [Fact]
    public async Task Inbound_sem_outbound_seguinte_fica_fora_da_media()
    {
        using var context = new ConversationsTestContext();
        var conversation = context.AddConversation();
        context.AddInbound(conversation.Id, NowUtc);
        context.AddOutbound(conversation.Id, context.SdrUserId, NowUtc.AddMinutes(5));
        context.AddInbound(conversation.Id, NowUtc.AddMinutes(20)); // sem resposta ainda

        var dto = await new GetConversationContextQueryHandler(context.Db, context.As(context.SdrUserId, DefaultRole.Sdr))
            .Handle(new GetConversationContextQuery(conversation.Id), TestContext.Current.CancellationToken);

        Assert.Equal(5, dto.Summary.AverageResponseTimeMinutes);
    }

    [Fact]
    public async Task CNPJ_e_site_da_empresa_nascem_nulos_e_aparecem_no_contexto()
    {
        using var context = new ConversationsTestContext();
        var conversation = context.AddConversation();

        var dto = await new GetConversationContextQueryHandler(context.Db, context.As(context.SdrUserId, DefaultRole.Sdr))
            .Handle(new GetConversationContextQuery(conversation.Id), TestContext.Current.CancellationToken);

        Assert.Null(dto.CompanyCnpj);
        Assert.Null(dto.CompanyWebsite);
    }
}
