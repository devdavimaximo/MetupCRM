using System.Text.Json;
using System.Text.Json.Serialization;
using Metup.Application.Deals.Commands.CreateDeal;
using Metup.Application.Deals.Commands.UpdateDeal;
using Metup.Application.Integrations.Commands.ReceiveMetaAdsLead;
using Metup.Application.Tests.Dashboard;
using Metup.Domain.Deals;
using Metup.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Metup.Application.Tests.Deals;

public class DealSourceTests
{
    [Fact]
    public void Nomes_que_o_n8n_ja_envia_continuam_iguais()
    {
        // Contrato com o n8n e valores já gravados no banco: renomear quebra ingestão e histórico.
        Assert.Equal("Sdr", DealSource.Sdr.ToString());
        Assert.Equal("WhatsApp", DealSource.WhatsApp.ToString());
        Assert.Equal("MetaAds", DealSource.MetaAds.ToString());

        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        options.Converters.Add(new JsonStringEnumConverter());
        Assert.Equal(DealSource.MetaAds, JsonSerializer.Deserialize<DealSource>("\"MetaAds\"", options));
        Assert.Equal(DealSource.Indicacao, JsonSerializer.Deserialize<DealSource>("\"Indicacao\"", options));
    }

    [Fact]
    public void Todo_valor_cabe_na_coluna_de_origem()
    {
        // deals.source é varchar(20).
        Assert.All(Enum.GetNames<DealSource>(), name => Assert.True(name.Length <= 20, name));
    }

    [Fact]
    public async Task Ingestao_do_Meta_Ads_continua_gravando_a_origem_MetaAds()
    {
        using var context = new DashboardOverviewTestContext();
        var handler = new ReceiveMetaAdsLeadCommandHandler(context.Db, context.As(context.AdminUserId, DefaultRole.Admin), new RecordingPublisher());

        var dto = await handler.Handle(
            new ReceiveMetaAdsLeadCommand("lead-1", "Empresa Beta", "Bia", null, null, context.SdrUserId, 1_000m, null),
            TestContext.Current.CancellationToken);

        Assert.Equal(DealSource.MetaAds, dto.Source);
        var stored = await context.Db.Deals.SingleAsync(d => d.Id == dto.Id, TestContext.Current.CancellationToken);
        Assert.Equal(DealSource.MetaAds, stored.Source);
    }

    [Theory]
    [InlineData(DealSource.Indicacao, true)]
    [InlineData(DealSource.Outro, true)]
    [InlineData((DealSource)99, false)]
    public async Task Validadores_aceitam_as_origens_novas_e_recusam_valor_inexistente(DealSource source, bool valid)
    {
        var create = await new CreateDealCommandValidator().ValidateAsync(
            new CreateDealCommand(Guid.NewGuid(), null, source, Guid.NewGuid(), null, null),
            TestContext.Current.CancellationToken);
        var update = await new UpdateDealCommandValidator().ValidateAsync(
            new UpdateDealCommand(Guid.NewGuid(), null, source, Guid.NewGuid(), null, null),
            TestContext.Current.CancellationToken);

        Assert.Equal(valid, create.IsValid);
        Assert.Equal(valid, update.IsValid);
    }
}
