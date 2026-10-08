using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Extensions;
using Metup.Application.Dialer.Common;
using Metup.Application.Dialer.Queries.GetDialerQueue;
using Metup.Application.Tests.Dashboard;
using Metup.Application.Tests.Tasks;
using Metup.Domain.Activities;
using Metup.Domain.Contacts;
using Metup.Domain.Deals;
using Metup.Domain.LeadFinder;
using Metup.Domain.Users;
using Xunit;

namespace Metup.Application.Tests.Dialer;

/// <summary>
/// A fila do discador: só as ligações pendentes do próprio usuário até o fim de hoje (atrasadas
/// primeiro), um item por negócio, com os números discáveis e o contexto do buscador.
/// </summary>
public class DialerQueueTests
{
    // 12:00 em São Paulo.
    private static readonly DateTime NowUtc = new(2026, 9, 16, 15, 0, 0, DateTimeKind.Utc);

    private static readonly FakeOrganizationClock Clock = new(DashboardOverviewTestContext.SaoPaulo, NowUtc);

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static GetDialerQueueQueryHandler Queue(TasksTestContext context, Guid userId, DefaultRole role) =>
        new(context.Db, context.Base.As(userId, role), Clock);

    [Fact]
    public async Task Traz_so_as_ligacoes_pendentes_do_usuario_ate_o_fim_de_hoje_atrasadas_primeiro()
    {
        using var context = new TasksTestContext(NowUtc);
        var otherDeal = context.Base.AddOpenDeal(context.SdrUserId, null, null, NowUtc.AddDays(-5));
        var closedDeal = context.Base.AddClosedDeal(context.SdrUserId, won: false, null, NowUtc.AddDays(-5), NowUtc.AddDays(-1));

        var today = context.AddTask(NowUtc.AddHours(5));
        var overdue = context.AddTask(NowUtc.AddDays(-2), dealId: otherDeal.Id);
        context.AddTask(NowUtc.AddDays(1).AddHours(-2)); // amanhã 10:00 local — fora
        context.AddTask(NowUtc.AddHours(1), ownerUserId: context.AdminUserId, dealId: otherDeal.Id);
        context.AddTask(NowUtc.AddHours(1), type: ActivityType.WhatsApp, dealId: otherDeal.Id);
        context.AddTask(NowUtc.AddHours(-1), completedAtUtc: NowUtc.AddMinutes(-30), dealId: otherDeal.Id);
        context.AddTask(NowUtc.AddHours(1), dealId: closedDeal.Id);

        var queue = await Queue(context, context.SdrUserId, DefaultRole.Sdr).Handle(new GetDialerQueueQuery(), Ct);

        Assert.Equal([overdue.Id, today.Id], queue.Items.Select(i => i.TaskId));
        Assert.True(queue.Items[0].IsOverdue);
        Assert.False(queue.Items[1].IsOverdue);
        Assert.Equal(2, queue.TotalCount);
        Assert.Equal(new DateOnly(2026, 9, 16), queue.ReferenceDate);
    }

    [Fact]
    public async Task Negocio_com_duas_ligacoes_pendentes_aparece_uma_vez_pela_mais_antiga()
    {
        using var context = new TasksTestContext(NowUtc);
        var older = context.AddTask(NowUtc.AddHours(-3));
        context.AddTask(NowUtc.AddHours(2));

        var queue = await Queue(context, context.SdrUserId, DefaultRole.Sdr).Handle(new GetDialerQueueQuery(), Ct);

        var item = Assert.Single(queue.Items);
        Assert.Equal(older.Id, item.TaskId);
        Assert.Equal(context.Deal.Id, item.DealId);
    }

    [Fact]
    public async Task Numeros_vem_do_contato_antes_da_empresa_sem_repetidos_e_normalizados_para_discar()
    {
        using var context = new TasksTestContext(NowUtc);
        var company = context.Db.Companies.Single(c => c.Id == context.Base.CompanyId);
        company.Phone = "(11) 3456-7890";
        var contact = new Contact
        {
            OrganizationId = context.OrganizationId,
            CompanyId = company.Id,
            Name = "Rui Dono",
            Role = "Sócio",
            Phone = "11 91234-5678",
            WhatsApp = "+55 (11) 91234-5678",
        };
        context.Db.Contacts.Add(contact);
        context.Deal.ContactId = contact.Id;
        context.Db.SaveChanges();
        context.AddTask(NowUtc);

        var queue = await Queue(context, context.SdrUserId, DefaultRole.Sdr).Handle(new GetDialerQueueQuery(), Ct);

        var item = Assert.Single(queue.Items);
        Assert.Equal("Rui Dono", item.ContactName);
        Assert.Equal(
            [
                new DialerPhoneDto(DialerPhoneKind.Contact, "11 91234-5678", "+5511912345678"),
                new DialerPhoneDto(DialerPhoneKind.Company, "(11) 3456-7890", "+551134567890"),
            ],
            item.Phones);
    }

    [Fact]
    public async Task Mostra_tentativas_anteriores_e_o_que_o_buscador_trouxe()
    {
        using var context = new TasksTestContext(NowUtc);
        context.AddTask(NowUtc);
        context.Db.Activities.Add(Activity.Log(context.OrganizationId, context.Deal.Id, null, ActivityType.Call, ActivityOutcome.NaoAtendeu, null, context.SdrUserId, NowUtc.AddDays(-2)));
        context.Db.Activities.Add(Activity.Log(context.OrganizationId, context.Deal.Id, null, ActivityType.Call, ActivityOutcome.PediuRetorno, null, context.AdminUserId, NowUtc.AddDays(-1)));
        context.Db.Activities.Add(Activity.Log(context.OrganizationId, context.Deal.Id, null, ActivityType.Note, null, "nota", context.SdrUserId, NowUtc.AddHours(-1)));

        var search = LeadSearch.Request(context.OrganizationId, "pizzaria", "Curitiba", 50, false, context.SdrUserId, NowUtc.AddDays(-3));
        var lead = new FoundLead
        {
            OrganizationId = context.OrganizationId,
            LeadSearchId = search.Id,
            DedupeKey = "place:abc",
            Name = "Pizzaria Bella",
            Category = "Pizzaria",
            Rating = 4.7m,
            ReviewCount = 312,
            Address = "Rua XV, 100",
            MapsUrl = "https://maps.google.com/?cid=1",
            FoundAt = NowUtc.AddDays(-3),
        };
        lead.MarkImported(context.Base.CompanyId, context.Deal.Id, context.SdrUserId, NowUtc.AddDays(-3));
        context.Db.LeadSearches.Add(search);
        context.Db.FoundLeads.Add(lead);
        context.Db.SaveChanges();

        var queue = await Queue(context, context.SdrUserId, DefaultRole.Sdr).Handle(new GetDialerQueueQuery(), Ct);

        var item = Assert.Single(queue.Items);
        Assert.Equal(new DialerCallHistoryDto(2, ActivityOutcome.PediuRetorno, NowUtc.AddDays(-1)), item.CallHistory);
        Assert.NotNull(item.Lead);
        Assert.Equal("pizzaria", item.Lead.SearchQuery);
        Assert.Equal(4.7m, item.Lead.Rating);
        Assert.Equal(312, item.Lead.ReviewCount);
    }

    [Fact]
    public async Task Sem_a_permissao_do_discador_e_recusado()
    {
        using var context = new TasksTestContext(NowUtc);

        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            new GetDialerQueueQueryHandler(context.Db, new FakeServiceTokenUser(context.OrganizationId), Clock)
                .Handle(new GetDialerQueueQuery(), Ct));
    }

    [Theory]
    [InlineData("(11) 91234-5678", "+5511912345678")]
    [InlineData("011 3456-7890", "+551134567890")]
    [InlineData("+55 41 3333-4444", "+554133334444")]
    [InlineData("0800 123 4567", "08001234567")]
    [InlineData("4004-1234", "40041234")]
    [InlineData("3456-7890", null)]
    [InlineData("123", null)]
    public void Numero_discavel_e_E164_ou_numero_de_servico(string input, string? expected) =>
        Assert.Equal(expected, input.ToDialString());
}
