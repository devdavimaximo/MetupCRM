using System.Globalization;
using System.Linq.Expressions;
using System.Text;
using Metup.Application.Common.Interfaces;
using Metup.Application.Search.Queries.GlobalSearch;
using Metup.Application.Tests.Conversations;
using Metup.Application.Tests.Dashboard;
using Metup.Domain.Companies;
using Metup.Domain.Contacts;
using Metup.Domain.Conversations;
using Metup.Domain.Users;
using Metup.Infrastructure.Persistence;
using Metup.Infrastructure.Search;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Metup.Application.Tests.Search;

/// <summary>
/// Equivalente em memória do <see cref="NpgsqlTextSearch"/>: minúsculas e sem diacríticos, como o
/// <c>unaccent</c> + <c>ILIKE</c> do Postgres. Serve para testar o caso de uso (escopo, grupos, limites).
/// </summary>
public sealed class InMemoryTextSearch : ITextSearch
{
    private static readonly System.Reflection.MethodInfo MatchesMethod = typeof(InMemoryTextSearch).GetMethod(nameof(Matches))!;

    public IQueryable<T> WhereAnyContains<T>(IQueryable<T> source, string term, params Expression<Func<T, string?>>[] fields)
    {
        // Árvore de expressão (não AsEnumerable): o provedor em memória avalia Matches e o ToListAsync continua valendo.
        var parameter = Expression.Parameter(typeof(T), "row");
        var needle = Expression.Constant(Fold(term));
        var body = fields
            .Select(f => (Expression)Expression.Call(MatchesMethod, Expression.Invoke(f, parameter), needle))
            .Aggregate(Expression.OrElse);
        return source.Where(Expression.Lambda<Func<T, bool>>(body, parameter));
    }

    public static bool Matches(string? value, string foldedTerm) => Fold(value ?? string.Empty).Contains(foldedTerm);

    private static string Fold(string value) =>
        new string(value.Normalize(NormalizationForm.FormD)
            .Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
            .ToArray()).ToLowerInvariant();
}

public class SearchTests
{
    private static readonly DateTime NowUtc = new(2026, 9, 15, 17, 0, 0, DateTimeKind.Utc);

    private static SearchQueryHandler Handler(DashboardOverviewTestContext context, Guid userId, UserRole role) =>
        new(context.Db, context.As(userId, role), new InMemoryTextSearch());

    private static Company AddCompany(DashboardOverviewTestContext context, string name, string? city = null, string? segment = null)
    {
        var company = new Company { OrganizationId = context.OrganizationId, Name = name, City = city, Segment = segment };
        context.Db.Companies.Add(company);
        context.Db.SaveChanges();
        return company;
    }

    [Fact]
    public async Task Termo_sem_acento_encontra_texto_com_acento_em_empresa_e_contato()
    {
        using var context = new DashboardOverviewTestContext();
        var company = AddCompany(context, "Padaria Pão Quente", city: "São Paulo", segment: "Alimentação");
        AddCompany(context, "Oficina Rio", city: "Rio de Janeiro");
        context.Db.Contacts.Add(new Contact { OrganizationId = context.OrganizationId, CompanyId = company.Id, Name = "João Conceição" });
        context.Db.SaveChanges();

        var handler = Handler(context, context.AdminUserId, UserRole.Admin);

        var byCity = await handler.Handle(new SearchQuery("sao paulo"), TestContext.Current.CancellationToken);
        Assert.Equal("Padaria Pão Quente", Assert.Single(byCity.Companies).Name);

        var byContact = await handler.Handle(new SearchQuery("CONCEICAO"), TestContext.Current.CancellationToken);
        var contact = Assert.Single(byContact.Contacts);
        Assert.Equal(company.Id, contact.CompanyId);
        Assert.Equal("Padaria Pão Quente", contact.CompanyName);
    }

    [Fact]
    public async Task Negocios_sao_encontrados_pela_empresa_e_o_SDR_so_ve_os_dele()
    {
        using var context = new DashboardOverviewTestContext();
        // A empresa padrão do contexto é "Empresa Alfa".
        var mine = context.AddOpenDeal(context.SdrUserId, amount: 5_000m, ticket: null, NowUtc.AddDays(-3));
        context.AddOpenDeal(context.AdminUserId, amount: 90_000m, ticket: null, NowUtc.AddDays(-3));

        var sdr = await Handler(context, context.SdrUserId, UserRole.Sdr).Handle(new SearchQuery("alfa"), TestContext.Current.CancellationToken);
        var admin = await Handler(context, context.AdminUserId, UserRole.Admin).Handle(new SearchQuery("alfa"), TestContext.Current.CancellationToken);

        Assert.Equal(mine.Id, Assert.Single(sdr.Deals).Id);
        Assert.Equal(2, admin.Deals.Count);
        Assert.Equal(90_000m, admin.Deals[0].Amount); // abertos, do maior valor para o menor
        Assert.Single(sdr.Companies); // empresas são da organização inteira, como a tela de Empresas
    }

    [Fact]
    public async Task No_maximo_cinco_resultados_por_grupo()
    {
        using var context = new DashboardOverviewTestContext();
        for (var i = 0; i < 8; i++)
        {
            AddCompany(context, $"Mercado {i}");
        }

        var result = await Handler(context, context.AdminUserId, UserRole.Admin).Handle(new SearchQuery("mercado"), TestContext.Current.CancellationToken);

        Assert.Equal(SearchQuery.MaxHitsPerGroup, result.Companies.Count);
    }

    [Fact]
    public async Task Conversas_sao_encontradas_pelo_contato_ou_pela_empresa_sem_acento_e_da_organizacao_inteira()
    {
        using var conversations = new ConversationsTestContext();
        var conversation = conversations.AddConversation();
        conversations.AddInbound(conversation.Id, NowUtc, "Olá, tudo bem?");

        var handler = new SearchQueryHandler(conversations.Db, conversations.As(conversations.SdrUserId, UserRole.Sdr), new InMemoryTextSearch());

        var byContact = await handler.Handle(new SearchQuery("BIA"), TestContext.Current.CancellationToken);
        var hit = Assert.Single(byContact.Conversations);
        Assert.Equal(conversation.Id, hit.Id);
        Assert.Equal("Bia Cliente", hit.ContactName);
        Assert.Equal("Empresa Alfa", hit.CompanyName);
        Assert.Equal("Olá, tudo bem?", hit.LastMessagePreview);

        // A conversa não tem responsável (a Inbox é compartilhada) — o SDR também encontra pela empresa.
        var byCompany = await handler.Handle(new SearchQuery("alfa"), TestContext.Current.CancellationToken);
        Assert.Single(byCompany.Conversations);
    }

    [Fact]
    public async Task No_maximo_cinco_conversas_por_grupo()
    {
        using var context = new DashboardOverviewTestContext();
        for (var i = 0; i < 8; i++)
        {
            var contact = new Contact { OrganizationId = context.OrganizationId, CompanyId = context.CompanyId, Name = $"Cliente Mercado {i}" };
            context.Db.Contacts.Add(contact);
            context.Db.SaveChanges();
            context.Db.Conversations.Add(Conversation.Create(context.OrganizationId, contact.Id, ConversationChannel.WhatsApp));
            context.Db.SaveChanges();
        }

        var result = await Handler(context, context.AdminUserId, UserRole.Admin).Handle(new SearchQuery("mercado"), TestContext.Current.CancellationToken);

        Assert.Equal(SearchQuery.MaxHitsPerGroup, result.Conversations.Count);
    }

    [Theory]
    [InlineData("a", false)]
    [InlineData("  a ", false)]
    [InlineData("ab", true)]
    public async Task Validador_exige_dois_caracteres(string term, bool valid)
    {
        var result = await new SearchQueryValidator().ValidateAsync(new SearchQuery(term), TestContext.Current.CancellationToken);
        Assert.Equal(valid, result.IsValid);
    }

    [Fact]
    public void No_Postgres_a_busca_usa_unaccent_e_ILIKE_com_o_termo_parametrizado_e_escapado()
    {
        // Só gera o SQL: nenhuma conexão é aberta.
        var options = new DbContextOptionsBuilder<MetupDbContext>().UseNpgsql("Host=localhost;Database=never").Options;
        using var db = new MetupDbContext(options);

        var sql = new NpgsqlTextSearch()
            .WhereAnyContains(db.Companies, "50%_x", c => c.Name, c => c.City)
            .ToQueryString();

        // O cabeçalho do ToQueryString mostra o valor do parâmetro; o corpo só pode referenciá-lo.
        var body = sql[sql.IndexOf("SELECT", StringComparison.Ordinal)..];
        Assert.Contains(@"-- @SearchPattern='%50\%\_x%'", sql);
        Assert.Contains("unaccent(c.name) ILIKE unaccent(@SearchPattern)", body);
        Assert.Contains("unaccent(c.city) ILIKE unaccent(@SearchPattern)", body);
        Assert.DoesNotContain("50", body);
    }
}
