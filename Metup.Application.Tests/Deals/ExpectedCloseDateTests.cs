using Metup.Application.Deals.Commands.CreateDeal;
using Metup.Application.Deals.Commands.UpdateDeal;
using Metup.Application.Tests.Dashboard;
using Metup.Domain.Common.Exceptions;
using Metup.Domain.Deals;
using Metup.Domain.Users;
using Xunit;

namespace Metup.Application.Tests.Deals;

public class ExpectedCloseDateTests
{
    private static Deal NewDeal() => new() { CreatedAt = new DateTime(2026, 9, 10, 15, 0, 0, DateTimeKind.Utc) };

    [Fact]
    public void Previsao_anterior_a_criacao_e_recusada_pelo_dominio()
    {
        var deal = NewDeal();

        Assert.Throws<DomainRuleException>(() => deal.SetExpectedCloseDate(new DateOnly(2026, 9, 9), new DateOnly(2026, 9, 10)));
        Assert.Null(deal.ExpectedCloseDate);
    }

    [Fact]
    public void Previsao_no_proprio_dia_da_criacao_e_aceita_e_null_limpa()
    {
        var deal = NewDeal();

        deal.SetExpectedCloseDate(new DateOnly(2026, 9, 10), new DateOnly(2026, 9, 10));
        Assert.Equal(new DateOnly(2026, 9, 10), deal.ExpectedCloseDate);

        deal.SetExpectedCloseDate(null, new DateOnly(2026, 9, 10));
        Assert.Null(deal.ExpectedCloseDate);
    }

    [Fact]
    public async Task Atualizacao_compara_com_o_dia_local_da_criacao_e_nao_com_o_dia_UTC()
    {
        using var context = new DashboardOverviewTestContext();
        // Criado 14/09 às 23h30 em SP = 15/09 02h30 UTC. Previsão "14/09" é o próprio dia local da criação.
        var deal = context.AddOpenDeal(
            context.AdminUserId, amount: null, ticket: null, createdAtUtc: new DateTime(2026, 9, 15, 2, 30, 0, DateTimeKind.Utc));
        var handler = new UpdateDealCommandHandler(
            context.Db,
            context.As(context.AdminUserId, DefaultRole.Admin),
            new FakeOrganizationClock(DashboardOverviewTestContext.SaoPaulo, new DateTime(2026, 9, 15, 17, 0, 0, DateTimeKind.Utc)));

        var dto = await handler.Handle(
            new UpdateDealCommand(deal.Id, null, DealSource.Sdr, context.AdminUserId, null, null, new DateOnly(2026, 9, 14)),
            TestContext.Current.CancellationToken);

        Assert.Equal(new DateOnly(2026, 9, 14), dto.ExpectedCloseDate);

        await Assert.ThrowsAsync<DomainRuleException>(() => handler.Handle(
            new UpdateDealCommand(deal.Id, null, DealSource.Sdr, context.AdminUserId, null, null, new DateOnly(2026, 9, 13)),
            TestContext.Current.CancellationToken));
    }

    [Theory]
    [InlineData(1, 1, 1, false)]
    [InlineData(9999, 12, 31, false)]
    [InlineData(2026, 12, 1, true)]
    public async Task Validadores_barram_datas_sem_sentido(int year, int month, int day, bool valid)
    {
        var date = new DateOnly(year, month, day);
        var owner = Guid.NewGuid();

        var create = await new CreateDealCommandValidator().ValidateAsync(
            new CreateDealCommand(Guid.NewGuid(), null, DealSource.Sdr, owner, null, null, ExpectedCloseDate: date),
            TestContext.Current.CancellationToken);
        var update = await new UpdateDealCommandValidator().ValidateAsync(
            new UpdateDealCommand(Guid.NewGuid(), null, DealSource.Sdr, owner, null, null, date),
            TestContext.Current.CancellationToken);

        Assert.Equal(valid, create.IsValid);
        Assert.Equal(valid, update.IsValid);
    }
}
