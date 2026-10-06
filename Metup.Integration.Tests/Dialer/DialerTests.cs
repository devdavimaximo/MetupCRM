using Metup.Application.Activities.Commands.LogActivity;
using Metup.Application.Dialer.Queries.GetDialerQueue;
using Metup.Application.LeadFinder.Commands.ImportFoundLeads;
using Metup.Application.Telephony.Commands.CreatePhoneLine;
using Metup.Domain.Activities;
using Metup.Domain.Common.Exceptions;
using Metup.Domain.LeadFinder;
using Metup.Domain.Tasks;
using Metup.Domain.Telephony;
using Metup.Integration.Tests.LeadFinder;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Metup.Integration.Tests.Dialer;

/// <summary>
/// "Importar e discar" de ponta a ponta contra Postgres real: o lead importado cai na fila do SDR com
/// o contexto do buscador, a ligação registrada pela linha dele conclui a tarefa e some da fila. A
/// fila junta quatro tabelas com left join — tradução que o provedor em memória não prova.
/// </summary>
public class DialerTests(LeadFinderDatabase fixture) : IClassFixture<LeadFinderDatabase>
{
    private static readonly TimeZoneInfo SaoPaulo = TimeZoneInfo.FindSystemTimeZoneById("America/Sao_Paulo");

    // 11:00 em São Paulo.
    private static readonly DateTime NowUtc = new(2026, 10, 6, 14, 0, 0, DateTimeKind.Utc);

    private static FrozenOrganizationClock Clock => new(SaoPaulo, NowUtc);

    [Fact]
    public async Task Lead_importado_para_discar_entra_na_fila_e_sai_ao_registrar_a_ligacao_pela_linha_do_SDR()
    {
        var org = await fixture.NewOrganizationAsync();
        var leadId = await SeedFoundLeadAsync(org);

        Guid dealId;
        await using (var db = fixture.Database.Open(org.Id))
        {
            var import = await new ImportFoundLeadsCommandHandler(db, org.Sdr, Clock, new NullPublisher())
                .Handle(new ImportFoundLeadsCommand([leadId], OwnerUserId: null, ScheduleCall: true), default);
            dealId = Assert.Single(import.DealIds);
        }

        Guid lineId;
        await using (var db = fixture.Database.Open(org.Id))
        {
            lineId = (await new CreatePhoneLineCommandHandler(db, org.Admin, Clock)
                .Handle(new CreatePhoneLineCommand(org.SdrId, PhoneLineKind.Device, "Celular", "(41) 99876-5432", false), default)).Id;
        }

        GetDialerQueueQueryHandler Queue(Infrastructure.Persistence.MetupDbContext db) => new(db, org.Sdr, Clock);

        await using (var db = fixture.Database.Open(org.Id))
        {
            var queue = await Queue(db).Handle(new GetDialerQueueQuery(), default);
            var item = Assert.Single(queue.Items);
            Assert.Equal(dealId, item.DealId);
            Assert.Equal("Pizzaria Bella", item.CompanyName);
            Assert.Equal("+554133334444", Assert.Single(item.Phones).Dial);
            Assert.Null(item.ContactId);
            Assert.Equal(0, item.CallHistory.Attempts);
            Assert.NotNull(item.Lead);
            Assert.Equal("pizzaria", item.Lead.SearchQuery);
            Assert.Equal(4.6m, item.Lead.Rating);

            await new LogActivityCommandHandler(db, org.Sdr, Clock, new NullPublisher()).Handle(
                new LogActivityCommand(dealId, null, ActivityType.Call, ActivityOutcome.NaoAtendeu, null, NowUtc,
                    ActivityType.Call, NowUtc.AddDays(1), null, CompletesTaskId: item.TaskId, PhoneLineId: lineId),
                default);
        }

        await using (var db = fixture.Database.Open(org.Id))
        {
            var queue = await Queue(db).Handle(new GetDialerQueueQuery(), default);
            Assert.Empty(queue.Items);

            var call = await db.Activities.SingleAsync(a => a.DealId == dealId);
            Assert.Equal(lineId, call.PhoneLineId);
            Assert.Equal(1, await db.Tasks.CountAsync(t => t.DealId == dealId && t.Status == TaskItemStatus.Pendente));
        }
    }

    [Fact]
    public async Task Numero_ativo_repetido_e_recusado_e_o_indice_unico_parcial_libera_o_desativado()
    {
        var org = await fixture.NewOrganizationAsync();

        await using (var db = fixture.Database.Open(org.Id))
        {
            await new CreatePhoneLineCommandHandler(db, org.Admin, Clock)
                .Handle(new CreatePhoneLineCommand(org.SdrId, PhoneLineKind.Device, "Celular", "(41) 99876-5432", false), default);

            await Assert.ThrowsAsync<DomainRuleException>(() => new CreatePhoneLineCommandHandler(db, org.Admin, Clock)
                .Handle(new CreatePhoneLineCommand(org.AdminId, PhoneLineKind.Device, "Meu", "41 99876 5432", false), default));
        }

        // Direto no banco: o índice também segura dois ativos iguais, mas aceita um desativado ao lado.
        await using (var db = fixture.Database.Open(org.Id))
        {
            var inactive = PhoneLine.Create(org.Id, org.AdminId, PhoneLineKind.Device, "Antigo", "(41) 99876-5432", "+5541998765432", false, org.AdminId, NowUtc);
            inactive.Deactivate();
            db.PhoneLines.Add(inactive);
            await db.SaveChangesAsync();

            db.PhoneLines.Add(PhoneLine.Create(org.Id, org.AdminId, PhoneLineKind.Device, "Duplicado", "(41) 99876-5432", "+5541998765432", false, org.AdminId, NowUtc));
            await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
        }
    }

    private async Task<Guid> SeedFoundLeadAsync(TestOrganization org)
    {
        await using var db = fixture.Database.Open(org.Id);
        var search = LeadSearch.Request(org.Id, "pizzaria", "Curitiba", 20, org.SdrId, NowUtc.AddHours(-2));
        var lead = new FoundLead
        {
            OrganizationId = org.Id,
            LeadSearchId = search.Id,
            DedupeKey = $"place:{Guid.NewGuid():N}",
            Name = "Pizzaria Bella",
            Category = "Pizzaria",
            Phone = "(41) 3333-4444",
            PhoneDigits = "4133334444",
            Rating = 4.6m,
            ReviewCount = 210,
            City = "Curitiba",
            FoundAt = NowUtc.AddHours(-1),
        };
        db.LeadSearches.Add(search);
        db.FoundLeads.Add(lead);
        await db.SaveChangesAsync();
        return lead.Id;
    }

    private sealed class NullPublisher : IPublisher
    {
        public Task Publish(object notification, CancellationToken cancellationToken = default) => Task.CompletedTask;

        public Task Publish<TNotification>(TNotification notification, CancellationToken cancellationToken = default)
            where TNotification : INotification => Task.CompletedTask;
    }
}
