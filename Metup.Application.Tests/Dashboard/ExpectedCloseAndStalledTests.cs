using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Models;
using Metup.Application.Dashboard.Common;
using Metup.Application.Dashboard.Queries.GetDashboardOverview;
using Metup.Application.Organizations.Commands.UpdateOrganizationSettings;
using Metup.Domain.Common.Exceptions;
using Metup.Domain.Deals;
using Metup.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Metup.Application.Tests.Dashboard;

public class ExpectedCloseAndStalledTests
{
    /// <summary>15/09/2026, 14h em São Paulo.</summary>
    private static readonly DateTime NowUtc = new(2026, 9, 15, 17, 0, 0, DateTimeKind.Utc);

    private static Task<DashboardOverviewDto> RunAsync(
        DashboardOverviewTestContext context,
        Guid userId,
        UserRole role,
        int days = 30,
        DateTime? nowUtc = null) =>
        new GetDashboardOverviewQueryHandler(
                context.Db,
                context.As(userId, role),
                new FakeOrganizationClock(DashboardOverviewTestContext.SaoPaulo, nowUtc ?? NowUtc))
            .Handle(new GetDashboardOverviewQuery(days, DealScope.Organization), TestContext.Current.CancellationToken);

    [Fact]
    public async Task Previsto_para_fechar_soma_o_valor_efetivo_dos_abertos_de_hoje_ate_o_fim_da_janela()
    {
        using var context = new DashboardOverviewTestContext();
        var created = NowUtc.AddDays(-20);
        context.AddOpenDeal(context.AdminUserId, amount: 10_000m, ticket: null, created, expectedCloseDate: new DateOnly(2026, 9, 15)); // hoje
        context.AddOpenDeal(context.AdminUserId, amount: null, ticket: 4_000m, created, expectedCloseDate: new DateOnly(2026, 9, 21)); // fim da janela de 7 dias
        context.AddOpenDeal(context.AdminUserId, amount: 99_000m, ticket: null, created, expectedCloseDate: new DateOnly(2026, 9, 22)); // fora
        context.AddOpenDeal(context.AdminUserId, amount: 5_000m, ticket: null, created, expectedCloseDate: new DateOnly(2026, 9, 14)); // vencida
        context.AddOpenDeal(context.AdminUserId, amount: 7_000m, ticket: null, created); // sem previsão
        context.AddClosedDeal(context.AdminUserId, won: true, amount: 50_000m, created, NowUtc.AddDays(-1)); // fechado não entra

        var overview = await RunAsync(context, context.AdminUserId, UserRole.Admin, days: 7);

        var expected = overview.ExpectedClose;
        Assert.Equal(new DateOnly(2026, 9, 15), expected.WindowStartLocal);
        Assert.Equal(new DateOnly(2026, 9, 21), expected.WindowEndLocal);
        Assert.Equal(14_000m, expected.ExpectedToCloseAmount);
        Assert.Equal(2, expected.ExpectedToCloseCount);
        Assert.Equal(1, expected.OverdueExpectedCount);
        Assert.Equal(4, expected.OpenDealsWithExpectedCloseDate);
    }

    [Fact]
    public async Task Hoje_da_previsao_e_o_dia_local_mesmo_quando_em_UTC_ja_e_amanha()
    {
        using var context = new DashboardOverviewTestContext();
        context.AddOpenDeal(context.AdminUserId, amount: 1_000m, ticket: null, NowUtc.AddDays(-5), expectedCloseDate: new DateOnly(2026, 9, 15));

        // 15/09 às 23h30 em SP = 16/09 02h30 UTC: a previsão de 15/09 ainda é "hoje", não vencida.
        var overview = await RunAsync(
            context, context.AdminUserId, UserRole.Admin, days: 7, nowUtc: new DateTime(2026, 9, 16, 2, 30, 0, DateTimeKind.Utc));

        Assert.Equal(1, overview.ExpectedClose.ExpectedToCloseCount);
        Assert.Equal(0, overview.ExpectedClose.OverdueExpectedCount);
    }

    [Fact]
    public async Task Previsto_para_fechar_respeita_o_escopo_do_SDR()
    {
        using var context = new DashboardOverviewTestContext();
        var created = NowUtc.AddDays(-5);
        context.AddOpenDeal(context.SdrUserId, amount: 2_000m, ticket: null, created, expectedCloseDate: new DateOnly(2026, 9, 20));
        context.AddOpenDeal(context.AdminUserId, amount: 30_000m, ticket: null, created, expectedCloseDate: new DateOnly(2026, 9, 20));
        context.AddOpenDeal(context.AdminUserId, amount: 30_000m, ticket: null, created, expectedCloseDate: new DateOnly(2026, 9, 1));

        var overview = await RunAsync(context, context.SdrUserId, UserRole.Sdr);

        Assert.Equal(2_000m, overview.ExpectedClose.ExpectedToCloseAmount);
        Assert.Equal(1, overview.ExpectedClose.ExpectedToCloseCount);
        Assert.Equal(0, overview.ExpectedClose.OverdueExpectedCount);
        Assert.Equal(1, overview.ExpectedClose.OpenDealsWithExpectedCloseDate);
    }

    [Fact]
    public async Task Negocio_em_destaque_traz_a_previsao()
    {
        using var context = new DashboardOverviewTestContext();
        context.AddOpenDeal(context.AdminUserId, amount: 1_000m, ticket: null, NowUtc.AddDays(-5), expectedCloseDate: new DateOnly(2026, 10, 1));

        var overview = await RunAsync(context, context.AdminUserId, UserRole.Admin);

        Assert.Equal(new DateOnly(2026, 10, 1), Assert.Single(overview.FeaturedDeals).ExpectedCloseDate);
    }

    [Fact]
    public async Task Parados_usam_o_limite_da_organizacao()
    {
        using var context = new DashboardOverviewTestContext();
        context.AddOpenDeal(context.AdminUserId, amount: 1_000m, ticket: null, NowUtc.AddDays(-7));

        var withDefault = await RunAsync(context, context.AdminUserId, UserRole.Admin);
        Assert.Equal(14, withDefault.StalledAfterDays);
        Assert.Equal(0, Assert.Single(withDefault.Pipeline).StalledCount);

        var organization = await context.Db.Organizations.SingleAsync(TestContext.Current.CancellationToken);
        organization.ChangeStalledDealDays(5);
        await context.Db.SaveChangesAsync(TestContext.Current.CancellationToken);

        var withFive = await RunAsync(context, context.AdminUserId, UserRole.Admin);
        Assert.Equal(5, withFive.StalledAfterDays);
        Assert.Equal(1, Assert.Single(withFive.Pipeline).StalledCount);
    }

    [Theory]
    [InlineData(UserRole.Sdr)]
    [InlineData(UserRole.Closer)]
    public async Task So_Admin_altera_o_limite_de_parado(UserRole role)
    {
        using var context = new DashboardOverviewTestContext();
        var handler = new UpdateOrganizationSettingsCommandHandler(context.Db, context.As(context.SdrUserId, role));

        // ForbiddenAccessException vira 403 no GlobalExceptionHandler.
        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            handler.Handle(new UpdateOrganizationSettingsCommand(30), TestContext.Current.CancellationToken));

        var organization = await context.Db.Organizations.AsNoTracking().SingleAsync(TestContext.Current.CancellationToken);
        Assert.Equal(14, organization.StalledDealDays);
    }

    [Fact]
    public async Task Admin_altera_o_limite_dentro_da_faixa()
    {
        using var context = new DashboardOverviewTestContext();
        var handler = new UpdateOrganizationSettingsCommandHandler(context.Db, context.As(context.AdminUserId, UserRole.Admin));

        var dto = await handler.Handle(new UpdateOrganizationSettingsCommand(30), TestContext.Current.CancellationToken);

        Assert.Equal(30, dto.StalledDealDays);
        await Assert.ThrowsAsync<DomainRuleException>(() =>
            handler.Handle(new UpdateOrganizationSettingsCommand(181), TestContext.Current.CancellationToken));
    }

    [Theory]
    [InlineData(0, false)]
    [InlineData(1, true)]
    [InlineData(180, true)]
    [InlineData(181, false)]
    public async Task Validador_do_limite_aceita_de_1_a_180(int days, bool valid)
    {
        var result = await new UpdateOrganizationSettingsCommandValidator()
            .ValidateAsync(new UpdateOrganizationSettingsCommand(days), TestContext.Current.CancellationToken);

        Assert.Equal(valid, result.IsValid);
    }
}
