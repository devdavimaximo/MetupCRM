using Metup.Domain.Common;
using Metup.Domain.Common.Exceptions;

namespace Metup.Domain.LeadFinder;

/// <summary>
/// Uma busca de leads por nicho e região ("clínicas odontológicas" em "Curitiba, PR"). Quem garimpa
/// é a automação do n8n (mapas, sites, IA); o CRM guarda o pedido, acompanha o andamento e recebe o
/// resultado em <see cref="FoundLead"/> — fronteira da seção 5 do CLAUDE.md. Pode nascer no CRM
/// (o SDR pede pela tela) ou na própria automação (disparo pelo chat do n8n).
/// </summary>
public class LeadSearch : BaseEntity
{
    public const int QueryMaxLength = 200;
    public const int LocationMaxLength = 200;
    public const int ExternalIdMaxLength = 200;
    public const int ErrorMessageMaxLength = 500;
    public const int MinResults = 1;
    public const int MaxResultsLimit = 500;

    /// <summary>O nicho, nas palavras de quem pediu.</summary>
    public string Query { get; private set; } = string.Empty;

    /// <summary>Cidade/região/bairro. Opcional: a automação pode receber a região dentro da própria frase.</summary>
    public string? Location { get; private set; }

    /// <summary>Teto de resultados pedido à automação (custo de API é dela, o limite é do CRM).</summary>
    public int? MaxResults { get; private set; }

    /// <summary>
    /// Só empresas sem site (público de quem vende presença digital). A automação filtra no garimpo, e
    /// o CRM confere de novo no recebimento — o filtro não depende de o n8n acertar.
    /// </summary>
    public bool WithoutWebsite { get; private set; }

    public LeadSearchStatus Status { get; private set; } = LeadSearchStatus.Requested;

    public LeadSearchOrigin Origin { get; private set; }

    /// <summary>Id da execução no n8n quando a busca nasce lá — dedupe se a automação reenviar.</summary>
    public string? ExternalId { get; private set; }

    /// <summary>Nulo quando a busca nasceu na automação.</summary>
    public Guid? RequestedByUserId { get; private set; }

    public DateTime RequestedAt { get; private set; }

    public DateTime? StartedAt { get; private set; }

    public DateTime? FinishedAt { get; private set; }

    /// <summary>Último sinal da automação (pedido, lote ou fim) — base de "a automação não responde".</summary>
    public DateTime LastActivityAt { get; private set; }

    /// <summary>Leads que a automação entregou para esta busca, contando os que já estavam na base.</summary>
    public int ReceivedCount { get; private set; }

    /// <summary>Leads inéditos que esta busca trouxe para a organização.</summary>
    public int NewCount { get; private set; }

    public string? ErrorMessage { get; private set; }

    public bool IsFinished => Status is LeadSearchStatus.Completed or LeadSearchStatus.Failed or LeadSearchStatus.Cancelled;

    public static LeadSearch Request(
        Guid organizationId,
        string query,
        string? location,
        int? maxResults,
        bool withoutWebsite,
        Guid requestedByUserId,
        DateTime nowUtc) =>
        new()
        {
            OrganizationId = organizationId,
            Query = query,
            Location = location,
            MaxResults = maxResults,
            WithoutWebsite = withoutWebsite,
            Origin = LeadSearchOrigin.Crm,
            RequestedByUserId = requestedByUserId,
            RequestedAt = nowUtc,
            LastActivityAt = nowUtc,
        };

    /// <summary>Busca disparada fora do CRM: já nasce em andamento, a automação está trabalhando.</summary>
    public static LeadSearch StartFromAutomation(
        Guid organizationId,
        string query,
        string? location,
        string externalId,
        DateTime nowUtc) =>
        new()
        {
            OrganizationId = organizationId,
            Query = query,
            Location = location,
            Origin = LeadSearchOrigin.Automation,
            ExternalId = externalId,
            Status = LeadSearchStatus.Running,
            RequestedAt = nowUtc,
            LastActivityAt = nowUtc,
            StartedAt = nowUtc,
        };

    /// <summary>
    /// Registra um lote entregue pela automação. Lote depois do fim é aceito (reenvio do n8n ou
    /// resultado atrasado) — só a busca cancelada recusa, porque quem cancelou não quer mais nada dela.
    /// </summary>
    public void RegisterBatch(int received, int inserted, DateTime nowUtc)
    {
        if (Status == LeadSearchStatus.Cancelled)
        {
            throw new DomainRuleException("Esta busca foi cancelada e não recebe mais resultados.");
        }

        MarkRunning(nowUtc);
        ReceivedCount += received;
        NewCount += inserted;
        LastActivityAt = nowUtc;
    }

    /// <summary>O lead cabe nos filtros pedidos? Lead fora deles é descartado no recebimento.</summary>
    public bool Accepts(string? website) => !WithoutWebsite || website is null;

    public void MarkRunning(DateTime nowUtc)
    {
        if (Status != LeadSearchStatus.Requested)
        {
            return;
        }

        Status = LeadSearchStatus.Running;
        StartedAt = nowUtc;
        LastActivityAt = nowUtc;
    }

    /// <summary>Fim relatado pela automação. Repetir o fim é inofensivo (o n8n pode reenviar).</summary>
    public void Finish(bool success, string? errorMessage, DateTime nowUtc)
    {
        if (IsFinished)
        {
            return;
        }

        StartedAt ??= nowUtc;
        Status = success ? LeadSearchStatus.Completed : LeadSearchStatus.Failed;
        ErrorMessage = success ? null : errorMessage;
        FinishedAt = nowUtc;
        LastActivityAt = nowUtc;
    }

    public void Cancel(DateTime nowUtc)
    {
        if (IsFinished)
        {
            throw new DomainRuleException("A busca já terminou.");
        }

        Status = LeadSearchStatus.Cancelled;
        FinishedAt = nowUtc;
    }

    /// <summary>
    /// Pedir de novo à automação uma busca que falhou ou ficou sem resposta. Volta ao começo,
    /// mantendo o que já tinha chegado (os leads já entregues continuam na base).
    /// </summary>
    public void Retry(DateTime nowUtc)
    {
        if (Origin != LeadSearchOrigin.Crm)
        {
            throw new DomainRuleException("Só buscas pedidas pelo CRM podem ser reenviadas à automação.");
        }

        if (Status is LeadSearchStatus.Completed or LeadSearchStatus.Cancelled)
        {
            throw new DomainRuleException("Só buscas com falha ou sem resposta podem ser reenviadas.");
        }

        Status = LeadSearchStatus.Requested;
        ErrorMessage = null;
        StartedAt = null;
        FinishedAt = null;
        RequestedAt = nowUtc;
        LastActivityAt = nowUtc;
    }

    /// <summary>Pedido que a automação não pegou neste prazo conta como "sem resposta".</summary>
    public static readonly TimeSpan AwaitingStartTimeout = TimeSpan.FromMinutes(3);

    /// <summary>Busca em andamento sem nenhum lote neste prazo também.</summary>
    public static readonly TimeSpan SilentRunTimeout = TimeSpan.FromMinutes(15);

    /// <summary>A automação parece não ter pego (ou ter abandonado) a busca — a tela oferece reenviar ou cancelar.</summary>
    public bool IsStalled(DateTime nowUtc) => Status switch
    {
        LeadSearchStatus.Requested => nowUtc - LastActivityAt > AwaitingStartTimeout,
        LeadSearchStatus.Running => nowUtc - LastActivityAt > SilentRunTimeout,
        _ => false,
    };
}
