using Metup.Application.Deals.Common;
using Metup.Application.Deals.Queries.GetDealBoard;
using Metup.Application.Deals.Queries.GetDealBoardColumn;
using Metup.Application.Deals.Queries.GetPipelineInsights;
using Metup.Domain.Deals;
using Metup.Domain.Users;
using Xunit;

namespace Metup.Application.Tests.Deals;

/// <summary>
/// Item 17 da PL3: maior volume, melhor passagem (com amostra mínima) e oportunidades em risco,
/// mais o filtro <c>stalledOnly</c> que a lista de riscos usa no quadro.
/// </summary>
public class PipelineInsightsTests
{
    private static readonly DateTime Now = PipelineTestContext.NowUtc;

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static readonly DealPipelineFilter AllOwners = new(AllOwners: true);

    [Fact]
    public async Task Maior_volume_e_a_etapa_com_mais_entradas_na_janela_com_o_percentual_do_total()
    {
        using var context = new PipelineTestContext();

        // Três negócios entram em Primeiro Contato na janela; um só chega a Qualificação.
        for (var i = 0; i < 3; i++)
        {
            context.AddDeal(context.SdrUserId, Now.AddDays(-10), amount: 1_000m, path: [DealStage.PrimeiroContato]);
        }

        context.AddDeal(context.SdrUserId, Now.AddDays(-8), amount: 1_000m, path: [DealStage.Qualificacao]);

        var insights = await context.Insights(context.AdminUserId, UserRole.Admin).Handle(new GetPipelineInsightsQuery(AllOwners), Ct);

        var volume = Assert.IsType<PipelineVolumeInsightDto>(insights.Volume);
        // 4 nascimentos em Prospect + 3 entradas em Primeiro Contato + 1 em Qualificação = 8.
        Assert.Equal((DealStage.Prospect, 4, 8), (volume.Stage, volume.Entered, volume.TotalEntered));
        Assert.Equal(0.5m, volume.PctOfTotal);
        Assert.Empty(volume.Tied);
    }

    [Fact]
    public async Task Sem_transicao_na_janela_nao_ha_volume_nem_passagem()
    {
        using var context = new PipelineTestContext();
        context.AddDeal(context.SdrUserId, Now.AddDays(-200), amount: 1_000m, path: [DealStage.Reuniao]);

        var insights = await context.Insights(context.AdminUserId, UserRole.Admin).Handle(new GetPipelineInsightsQuery(AllOwners), Ct);

        Assert.Null(insights.Volume);
        Assert.Null(insights.BestPassage);
    }

    [Fact]
    public async Task Melhor_passagem_exige_amostra_minima_e_nao_premia_um_de_um()
    {
        using var context = new PipelineTestContext();

        // Qualificação → Reunião: 5 entradas, 4 avançam (80%) — amostra suficiente.
        for (var i = 0; i < 5; i++)
        {
            var path = i < 4
                ? new[] { DealStage.Qualificacao, DealStage.Reuniao }
                : [DealStage.Qualificacao];
            context.AddDeal(context.SdrUserId, Now.AddDays(-12), amount: 1_000m, path: path);
        }

        // Proposta → Negociação: 1 entrada, 1 avança (100%) — abaixo da amostra mínima, fica de fora.
        context.AddDeal(context.SdrUserId, Now.AddDays(-9), amount: 1_000m, path: [DealStage.Proposta, DealStage.Negociacao]);

        // Prospect → Primeiro Contato tem amostra de sobra, mas passagem menor: 6 de 9 (etapa pulada conta).
        for (var i = 0; i < 3; i++)
        {
            context.AddDeal(context.SdrUserId, Now.AddDays(-11), amount: 1_000m);
        }

        var insights = await context.Insights(context.AdminUserId, UserRole.Admin).Handle(new GetPipelineInsightsQuery(AllOwners), Ct);

        var passage = Assert.IsType<PipelinePassageInsightDto>(insights.BestPassage);
        Assert.Equal((DealStage.Qualificacao, DealStage.Reuniao, 5, 4), (passage.FromStage, passage.ToStage, passage.Entered, passage.Advanced));
        Assert.Equal(0.8m, passage.Rate);
        Assert.Equal(PipelineInsightsDto.MinimumPassageSample, 5);
    }

    [Fact]
    public async Task Riscos_usam_o_limite_da_organizacao_e_so_de_qualificacao_em_diante()
    {
        using var context = new PipelineTestContext();
        var stalledDays = context.Db.Organizations.Single().StalledDealDays;

        // Parado e no meio do funil: entra no risco.
        context.AddDeal(context.SdrUserId, Now.AddDays(-(stalledDays + 30)), amount: 2_000m, path: [DealStage.Qualificacao]);
        // Parado, mas ainda no topo do funil: não é risco.
        context.AddDeal(context.SdrUserId, Now.AddDays(-(stalledDays + 30)), amount: 9_000m, path: [DealStage.PrimeiroContato]);
        // No meio do funil, mas mexido agora: não é risco.
        context.AddDeal(context.SdrUserId, Now.AddDays(-2), amount: 5_000m, path: [DealStage.Reuniao]);

        var insights = await context.Insights(context.AdminUserId, UserRole.Admin).Handle(new GetPipelineInsightsQuery(AllOwners), Ct);

        Assert.Equal((1, 2_000m, stalledDays), (insights.Risk.Count, insights.Risk.Value, insights.Risk.StalledAfterDays));
    }

    [Fact]
    public async Task Janela_sao_os_trinta_dias_que_terminam_na_referencia_e_o_escopo_do_sdr_e_o_dele()
    {
        using var context = new PipelineTestContext();
        var outside = context.AddDeal(context.AdminUserId, Now.AddDays(-45), amount: 1_000m, path: [DealStage.Reuniao]);
        Assert.NotNull(outside);
        context.AddDeal(context.SdrUserId, Now.AddDays(-3), amount: 1_000m, path: [DealStage.PrimeiroContato]);

        var insights = await context.Insights(context.SdrUserId, UserRole.Sdr).Handle(new GetPipelineInsightsQuery(AllOwners), Ct);

        Assert.Equal(context.SdrUserId, insights.OwnerUserId);
        Assert.Equal(new DateOnly(2026, 9, 15), insights.WindowEndLocal);
        Assert.Equal(new DateOnly(2026, 8, 17), insights.WindowStartLocal);

        // Só as transições do SDR entram: o negócio do Admin ficaria fora mesmo se estivesse na janela.
        var volume = Assert.IsType<PipelineVolumeInsightDto>(insights.Volume);
        Assert.Equal(2, volume.TotalEntered);
    }

    [Fact]
    public async Task StalledOnly_recorta_o_quadro_e_a_coluna_aos_parados()
    {
        using var context = new PipelineTestContext();
        var stalledDays = context.Db.Organizations.Single().StalledDealDays;
        context.AddDeal(context.SdrUserId, Now.AddDays(-(stalledDays + 30)), amount: 2_000m, path: [DealStage.Qualificacao]);
        context.AddDeal(context.SdrUserId, Now.AddDays(-2), amount: 5_000m, path: [DealStage.Qualificacao]);

        var stalled = AllOwners with { StalledOnly = true };
        var board = await context.Board(context.AdminUserId, UserRole.Admin).Handle(new GetDealBoardQuery(stalled), Ct);
        var qualification = board.Columns.Single(c => c.Stage == DealStage.Qualificacao);

        Assert.Equal((1, 2_000m), (qualification.Count, qualification.Total));
        Assert.True(qualification.Items.Single().IsStalled);

        var column = await context.Column(context.AdminUserId, UserRole.Admin)
            .Handle(new GetDealBoardColumnQuery(stalled, DealStage.Qualificacao), Ct);
        Assert.Equal(1, column.Count);

        var all = await context.Board(context.AdminUserId, UserRole.Admin).Handle(new GetDealBoardQuery(AllOwners), Ct);
        Assert.Equal(2, all.Columns.Single(c => c.Stage == DealStage.Qualificacao).Count);
    }
}
