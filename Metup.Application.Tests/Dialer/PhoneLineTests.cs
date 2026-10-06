using Metup.Application.Activities.Commands.LogActivity;
using Metup.Application.Common.Exceptions;
using Metup.Application.Telephony.Commands.CreatePhoneLine;
using Metup.Application.Telephony.Commands.SetPhoneLineActive;
using Metup.Application.Telephony.Commands.UpdatePhoneLine;
using Metup.Application.Telephony.Common;
using Metup.Application.Telephony.Queries.ListPhoneLines;
using Metup.Application.Tests.Dashboard;
using Metup.Application.Tests.Tasks;
using Metup.Domain.Activities;
using Metup.Domain.Common.Exceptions;
using Metup.Domain.Telephony;
using Metup.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Metup.Application.Tests.Dialer;

/// <summary>
/// Linhas por usuário: o administrador cadastra, cada número ativo fica com uma pessoa só, cada
/// usuário tem uma principal e a ligação registrada guarda a linha — só a do próprio autor.
/// </summary>
public class PhoneLineTests
{
    private static readonly DateTime NowUtc = new(2026, 9, 16, 15, 0, 0, DateTimeKind.Utc);

    private static readonly FakeOrganizationClock Clock = new(DashboardOverviewTestContext.SaoPaulo, NowUtc);

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static Task<PhoneLineDto> Create(TasksTestContext context, Guid userId, string number, bool isDefault = false, string label = "Celular") =>
        new CreatePhoneLineCommandHandler(context.Db, context.Base.As(context.AdminUserId, DefaultRole.Admin), Clock)
            .Handle(new CreatePhoneLineCommand(userId, PhoneLineKind.Device, label, number, isDefault), Ct);

    private static Task<PhoneLineDto> SetActive(TasksTestContext context, Guid lineId, bool isActive) =>
        new SetPhoneLineActiveCommandHandler(context.Db, context.Base.As(context.AdminUserId, DefaultRole.Admin))
            .Handle(new SetPhoneLineActiveCommand(lineId, isActive), Ct);

    private static async Task<Dictionary<Guid, bool>> Defaults(TasksTestContext context) =>
        await context.Db.PhoneLines.AsNoTracking().ToDictionaryAsync(l => l.Id, l => l.IsDefault, Ct);

    [Fact]
    public async Task Primeira_linha_e_a_principal_e_promover_outra_tira_a_marca_da_anterior()
    {
        using var context = new TasksTestContext(NowUtc);

        var first = await Create(context, context.SdrUserId, "(11) 91234-5678");
        var second = await Create(context, context.SdrUserId, "(11) 98888-7777", label: "Chip 2");

        Assert.True(first.IsDefault);
        Assert.False(second.IsDefault);
        Assert.Equal("+5511912345678", first.NumberE164);
        Assert.Equal("Sofia SDR", first.UserName);

        await new UpdatePhoneLineCommandHandler(context.Db, context.Base.As(context.AdminUserId, DefaultRole.Admin))
            .Handle(new UpdatePhoneLineCommand(second.Id, "Chip 2", "(11) 98888-7777", MakeDefault: true), Ct);

        var defaults = await Defaults(context);
        Assert.False(defaults[first.Id]);
        Assert.True(defaults[second.Id]);
    }

    [Fact]
    public async Task O_mesmo_numero_ativo_nao_fica_com_duas_pessoas_nem_escrito_de_outro_jeito()
    {
        using var context = new TasksTestContext(NowUtc);
        await Create(context, context.SdrUserId, "(11) 91234-5678");

        var error = await Assert.ThrowsAsync<DomainRuleException>(() => Create(context, context.AdminUserId, "+55 11 91234 5678"));
        Assert.Contains("Sofia SDR", error.Message);
    }

    [Fact]
    public async Task Desativar_a_principal_promove_outra_e_reativar_exige_o_numero_livre()
    {
        using var context = new TasksTestContext(NowUtc);
        var first = await Create(context, context.SdrUserId, "(11) 91234-5678");
        var second = await Create(context, context.SdrUserId, "(11) 98888-7777");

        var deactivated = await SetActive(context, first.Id, false);

        Assert.False(deactivated.IsActive);
        Assert.False(deactivated.IsDefault);
        Assert.True((await Defaults(context))[second.Id]);

        // Com a linha desativada o número ficou livre — e foi para outra pessoa.
        await Create(context, context.AdminUserId, "(11) 91234-5678");
        await Assert.ThrowsAsync<DomainRuleException>(() => SetActive(context, first.Id, true));
    }

    [Fact]
    public async Task So_quem_gerencia_linhas_cadastra_e_cada_um_ve_so_as_proprias_ativas()
    {
        using var context = new TasksTestContext(NowUtc);
        var sdr = context.Base.As(context.SdrUserId, DefaultRole.Sdr);

        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            new CreatePhoneLineCommandHandler(context.Db, sdr, Clock)
                .Handle(new CreatePhoneLineCommand(context.SdrUserId, PhoneLineKind.Device, "Meu", "(11) 91234-5678", false), Ct));
        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            new ListPhoneLinesQueryHandler(context.Db, sdr).Handle(new ListPhoneLinesQuery(), Ct));

        var mine = await Create(context, context.SdrUserId, "(11) 91234-5678");
        var inactive = await Create(context, context.SdrUserId, "(11) 97777-6666");
        await SetActive(context, inactive.Id, false);
        await Create(context, context.AdminUserId, "(11) 95555-4444");

        var lines = await new ListMyPhoneLinesQueryHandler(context.Db, sdr).Handle(new ListMyPhoneLinesQuery(), Ct);

        Assert.Equal([mine.Id], lines.Select(l => l.Id));
    }

    [Fact]
    public async Task Ligacao_guarda_a_linha_do_proprio_autor_e_recusa_a_de_outra_pessoa()
    {
        using var context = new TasksTestContext(NowUtc);
        var sdrLine = await Create(context, context.SdrUserId, "(11) 91234-5678");
        var adminLine = await Create(context, context.AdminUserId, "(11) 95555-4444");
        var log = new LogActivityCommandHandler(context.Db, context.Base.As(context.SdrUserId, DefaultRole.Sdr), Clock, new RecordingPublisher());

        LogActivityCommand Call(Guid lineId) => new(
            context.Deal.Id, null, ActivityType.Call, ActivityOutcome.NaoAtendeu, null, NowUtc,
            null, null, null, PhoneLineId: lineId);

        await Assert.ThrowsAsync<NotFoundException>(() => log.Handle(Call(adminLine.Id), Ct));

        var result = await log.Handle(Call(sdrLine.Id), Ct);

        var saved = await context.Db.Activities.AsNoTracking().SingleAsync(a => a.Id == result.Activity.Id, Ct);
        Assert.Equal(sdrLine.Id, saved.PhoneLineId);
    }
}
