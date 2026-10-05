using Metup.Domain.Common;
using Metup.Domain.Common.Exceptions;

namespace Metup.Domain.LeadFinder;

/// <summary>
/// Um estabelecimento que a automação encontrou. Fica numa "antessala" e não vai direto para
/// <c>Company</c>: lista garimpada tem ruído, e o SDR triá-la antes evita poluir a base e o funil.
/// Importar cria a empresa e o negócio (estágio Prospect, origem <c>LeadFinder</c>) — a partir
/// daí é o fluxo normal do funil, com histórico.
///
/// Único por organização pela <see cref="DedupeKey"/>: o mesmo lugar achado em duas buscas não vira
/// duas linhas, e um lead descartado não volta como novo.
/// </summary>
public class FoundLead : BaseEntity
{
    public const int DedupeKeyMaxLength = 320;
    public const int ExternalIdMaxLength = 300;
    public const int NameMaxLength = 200;
    public const int CategoryMaxLength = 120;
    public const int PhoneMaxLength = 40;
    public const int PhoneDigitsMaxLength = 20;
    public const int WebsiteMaxLength = 300;
    public const int EmailMaxLength = 320;
    public const int InstagramMaxLength = 120;
    public const int AddressMaxLength = 300;
    public const int CityMaxLength = 120;
    public const int StateMaxLength = 60;
    public const int MapsUrlMaxLength = 600;

    /// <summary>Busca que trouxe o lead pela primeira vez.</summary>
    public Guid LeadSearchId { get; init; }

    /// <summary>Chave de dedupe calculada pelo CRM (nunca pelo n8n) a partir do id externo, telefone ou nome+cidade.</summary>
    public string DedupeKey { get; init; } = string.Empty;

    /// <summary>Id do lugar na fonte (ex.: place_id do Google Maps).</summary>
    public string? ExternalId { get; init; }

    public string Name { get; set; } = string.Empty;

    public string? Category { get; set; }

    public string? Phone { get; set; }

    /// <summary>Só os dígitos de <see cref="Phone"/> — casar com empresas já cadastradas.</summary>
    public string? PhoneDigits { get; set; }

    public string? Website { get; set; }

    public string? Email { get; set; }

    public string? Instagram { get; set; }

    public string? Address { get; set; }

    public string? City { get; set; }

    public string? State { get; set; }

    /// <summary>Nota média na fonte (0–5). Decimal, não float: é dado exibido e filtrado, sem ruído de arredondamento.</summary>
    public decimal? Rating { get; set; }

    public int? ReviewCount { get; set; }

    public string? MapsUrl { get; set; }

    public FoundLeadStatus Status { get; private set; } = FoundLeadStatus.New;

    /// <summary>Empresa já cadastrada com o mesmo telefone, achada na chegada. Importar reaproveita esta empresa.</summary>
    public Guid? ExistingCompanyId { get; set; }

    /// <summary>Empresa e negócio que nasceram (ou foram reaproveitados) na importação.</summary>
    public Guid? CompanyId { get; private set; }

    public Guid? DealId { get; private set; }

    public DateTime FoundAt { get; init; }

    public DateTime? StatusChangedAt { get; private set; }

    public Guid? StatusChangedByUserId { get; private set; }

    public void MarkImported(Guid companyId, Guid dealId, Guid userId, DateTime nowUtc)
    {
        if (Status == FoundLeadStatus.Imported)
        {
            throw new DomainRuleException("Este lead já foi importado.");
        }

        Status = FoundLeadStatus.Imported;
        CompanyId = companyId;
        DealId = dealId;
        StatusChangedAt = nowUtc;
        StatusChangedByUserId = userId;
    }

    public void Discard(Guid userId, DateTime nowUtc)
    {
        if (Status != FoundLeadStatus.New)
        {
            throw new DomainRuleException("Só leads novos podem ser descartados.");
        }

        Status = FoundLeadStatus.Discarded;
        StatusChangedAt = nowUtc;
        StatusChangedByUserId = userId;
    }

    public void Restore(Guid userId, DateTime nowUtc)
    {
        if (Status != FoundLeadStatus.Discarded)
        {
            throw new DomainRuleException("Só leads descartados podem voltar para novos.");
        }

        Status = FoundLeadStatus.New;
        StatusChangedAt = nowUtc;
        StatusChangedByUserId = userId;
    }
}
