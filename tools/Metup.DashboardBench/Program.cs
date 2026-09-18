// Massa de volume + medição dos handlers do dashboard (item 22).
//
// Por que existe: o handler do overview lê os negócios e as transições da organização inteira numa
// projeção e agrega em memória. Isso é barato no volume da V1 e cresce linearmente com a base. Antes
// de otimizar, o plano manda medir — este é o instrumento da medição, e os números que ele imprime
// são a linha de base registrada em docs/planning/dashboard-melhorias.md.
//
// A massa é gerada com COPY binário (as três tabelas grandes) porque 500 mil linhas via EF levariam
// minutos e não é isso que se quer medir. Organização, usuários, empresas e contatos passam pelo EF:
// são poucos e assim respeitam o mapeamento real.
using System.Diagnostics;
using Metup.Application.Activities.Common;
using Metup.Application.Common.Interfaces;
using Metup.Application.Common.Models;
using Metup.Application.Dashboard.Queries.GetDashboardOverview;
using Metup.Application.Deals.Analytics;
using Metup.Domain.Activities;
using Metup.Domain.Companies;
using Metup.Domain.Contacts;
using Metup.Domain.Deals;
using Metup.Domain.Organizations;
using Metup.Domain.Users;
using Metup.Infrastructure.Persistence;
using Metup.Infrastructure.Time;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Npgsql;

const string OrgName = "Metup Perf";
const int TotalCompanies = 12_000;
const int TotalDeals = 50_000;
const int TotalActivities = 300_000;
const int TotalStageChanges = 150_000;
const int Owners = 10;

var command = args.FirstOrDefault() ?? "measure";
var connectionString = Environment.GetEnvironmentVariable("METUP_BENCH_CONNECTION");

if (string.IsNullOrWhiteSpace(connectionString))
{
    Console.Error.WriteLine("Defina METUP_BENCH_CONNECTION com a connection string do banco de medição.");
    Console.Error.WriteLine(@"Ex.: $env:METUP_BENCH_CONNECTION=""Host=localhost;Port=5432;Database=metup_perf;Username=postgres;Password=…""");
    return 1;
}

switch (command)
{
    case "seed":
        await SeedAsync(connectionString);
        return 0;
    case "measure":
        await MeasureAsync(connectionString);
        return 0;
    case "profile":
        await ProfileAsync(connectionString);
        return 0;
    default:
        Console.Error.WriteLine($"Comando desconhecido: {command}. Use 'seed' ou 'measure'.");
        return 1;
}

static MetupDbContext OpenContext(string connectionString)
{
    var options = new DbContextOptionsBuilder<MetupDbContext>().UseNpgsql(connectionString).Options;
    return new MetupDbContext(options);
}

/// <summary>Cria o banco se ele não existir, para a medição não depender de um passo manual.</summary>
static async Task EnsureDatabaseAsync(string connectionString)
{
    var builder = new NpgsqlConnectionStringBuilder(connectionString);
    var database = builder.Database!;
    builder.Database = "postgres";

    await using var admin = new NpgsqlConnection(builder.ConnectionString);
    await admin.OpenAsync();

    await using var exists = new NpgsqlCommand("SELECT 1 FROM pg_database WHERE datname = @name", admin);
    exists.Parameters.AddWithValue("name", database);
    if (await exists.ExecuteScalarAsync() is not null)
    {
        return;
    }

    Console.WriteLine($"Criando o banco {database}…");
    // O nome do banco não pode ser parâmetro; ele vem da connection string do próprio operador.
    await using var create = new NpgsqlCommand($"CREATE DATABASE \"{database.Replace("\"", "\"\"")}\"", admin);
    await create.ExecuteNonQueryAsync();
}

static async Task SeedAsync(string connectionString)
{
    await EnsureDatabaseAsync(connectionString);

    await using var db = OpenContext(connectionString);
    Console.WriteLine("Aplicando migrations…");
    await db.Database.MigrateAsync();

    var previous = await db.Organizations.FirstOrDefaultAsync(o => o.Name == OrgName);
    if (previous is not null)
    {
        Console.WriteLine("Removendo a massa anterior…");
        var id = previous.Id;
        await db.Activities.Where(a => a.OrganizationId == id).ExecuteDeleteAsync();
        await db.StageChanges.Where(s => s.OrganizationId == id).ExecuteDeleteAsync();
        await db.Tasks.Where(t => t.OrganizationId == id).ExecuteDeleteAsync();
        await db.Deals.Where(d => d.OrganizationId == id).ExecuteDeleteAsync();
        await db.Contacts.Where(c => c.OrganizationId == id).ExecuteDeleteAsync();
        await db.Companies.Where(c => c.OrganizationId == id).ExecuteDeleteAsync();
        await db.Users.Where(u => u.OrganizationId == id).ExecuteDeleteAsync();
        await db.Organizations.Where(o => o.Id == id).ExecuteDeleteAsync();
    }

    var rng = new Random(20260916);
    var org = new Organization { Name = OrgName };
    db.Organizations.Add(org);

    // O primeiro é Admin (enxerga a organização); o resto é SDR, para medir também o escopo "Mine".
    var users = Enumerable.Range(0, Owners)
        .Select(i => new User
        {
            OrganizationId = org.Id,
            Name = $"Operador {i:00}",
            Email = $"perf{i:00}@exemplo.invalido",
            PasswordHash = "x",
            Role = i == 0 ? UserRole.Admin : UserRole.Sdr,
        })
        .ToList();
    db.Users.AddRange(users);
    await db.SaveChangesAsync();

    Console.WriteLine($"Gerando {TotalCompanies:N0} empresas e contatos…");
    var companies = new List<Company>(TotalCompanies);
    var contacts = new List<Contact>(TotalCompanies);
    for (var i = 0; i < TotalCompanies; i++)
    {
        var company = new Company { OrganizationId = org.Id, Name = $"Empresa Perf {i:00000}", Segment = "Perf", City = "São Paulo" };
        companies.Add(company);
        contacts.Add(new Contact { OrganizationId = org.Id, CompanyId = company.Id, Name = $"Contato {i:00000}" });
    }

    db.Companies.AddRange(companies);
    db.Contacts.AddRange(contacts);
    await db.SaveChangesAsync();

    var now = DateTime.UtcNow;
    var stages = Enum.GetValues<DealStage>().Where(s => s is not (DealStage.Ganho or DealStage.Perdido)).ToArray();
    var sources = Enum.GetValues<DealSource>();

    Console.WriteLine($"Gerando {TotalDeals:N0} negócios…");
    var deals = new List<(Guid Id, Guid CompanyId, Guid ContactId, DealStage Stage, DealSource Source, Guid Owner,
        decimal? Ticket, decimal? Amount, DateOnly? Expected, DealStatus Status, DateTime CreatedAt, DateTime? ClosedAt)>(TotalDeals);

    for (var i = 0; i < TotalDeals; i++)
    {
        var company = companies[i % TotalCompanies];
        // Dois anos de histórico: uma janela de 30 dias pega ~4% da base, e a de 180 dias ~25%.
        var createdAt = now.AddDays(-rng.Next(0, 730)).AddHours(-rng.Next(0, 24));
        var roll = rng.NextDouble();
        var status = roll < 0.18 ? DealStatus.Ganho : roll < 0.34 ? DealStatus.Perdido : DealStatus.Aberto;
        var closedAt = status == DealStatus.Aberto ? (DateTime?)null : createdAt.AddDays(rng.Next(1, 90));
        if (closedAt > now) closedAt = now.AddDays(-rng.Next(0, 5));

        var ticket = (decimal)rng.Next(1_000, 40_000);
        deals.Add((
            Guid.CreateVersion7(), company.Id, contacts[i % TotalCompanies].Id,
            status == DealStatus.Ganho ? DealStage.Ganho : status == DealStatus.Perdido ? DealStage.Perdido : stages[rng.Next(stages.Length)],
            sources[rng.Next(sources.Length)],
            users[rng.Next(users.Count)].Id,
            ticket,
            // Um terço sem valor fechado, para o valor efetivo (item 1) ter o que fazer.
            rng.NextDouble() < 0.33 ? null : ticket + rng.Next(0, 5_000),
            rng.NextDouble() < 0.5 ? DateOnly.FromDateTime(now.AddDays(rng.Next(-30, 90))) : null,
            status, createdAt, closedAt));
    }

    await using var connection = new NpgsqlConnection(connectionString);
    await connection.OpenAsync();

    await CopyAsync(connection,
        "COPY deals (id, organization_id, company_id, contact_id, stage, source, owner_user_id, ticket, amount, expected_close_date, status, created_at, closed_at) FROM STDIN (FORMAT BINARY)",
        deals,
        async (writer, d) =>
        {
            await writer.WriteAsync(d.Id);
            await writer.WriteAsync(org.Id);
            await writer.WriteAsync(d.CompanyId);
            await writer.WriteAsync(d.ContactId);
            await writer.WriteAsync(d.Stage.ToString());
            await writer.WriteAsync(d.Source.ToString());
            await writer.WriteAsync(d.Owner);
            await writer.WriteAsync(d.Ticket!.Value);
            if (d.Amount is { } amount) await writer.WriteAsync(amount); else await writer.WriteNullAsync();
            if (d.Expected is { } expected) await writer.WriteAsync(expected); else await writer.WriteNullAsync();
            await writer.WriteAsync(d.Status.ToString());
            await writer.WriteAsync(d.CreatedAt);
            if (d.ClosedAt is { } closed) await writer.WriteAsync(closed); else await writer.WriteNullAsync();
        });

    Console.WriteLine($"Gerando {TotalStageChanges:N0} transições de etapa…");
    await CopyAsync(connection,
        "COPY stage_changes (id, organization_id, deal_id, from_stage, to_stage, changed_at, changed_by_user_id) FROM STDIN (FORMAT BINARY)",
        Enumerable.Range(0, TotalStageChanges),
        async (writer, i) =>
        {
            var deal = deals[i % TotalDeals];
            await writer.WriteAsync(Guid.CreateVersion7());
            await writer.WriteAsync(org.Id);
            await writer.WriteAsync(deal.Id);
            await writer.WriteNullAsync();
            await writer.WriteAsync(stages[rng.Next(stages.Length)].ToString());
            await writer.WriteAsync(deal.CreatedAt.AddDays(rng.Next(0, 60)));
            await writer.WriteAsync(deal.Owner);
        });

    Console.WriteLine($"Gerando {TotalActivities:N0} atividades…");
    var types = Enum.GetValues<ActivityType>();
    await CopyAsync(connection,
        "COPY activities (id, organization_id, deal_id, type, author_user_id, occurred_at, created_at) FROM STDIN (FORMAT BINARY)",
        Enumerable.Range(0, TotalActivities),
        async (writer, i) =>
        {
            var deal = deals[i % TotalDeals];
            var at = deal.CreatedAt.AddDays(rng.Next(0, 120));
            await writer.WriteAsync(Guid.CreateVersion7());
            await writer.WriteAsync(org.Id);
            await writer.WriteAsync(deal.Id);
            await writer.WriteAsync(types[rng.Next(types.Length)].ToString());
            await writer.WriteAsync(deal.Owner);
            await writer.WriteAsync(at > now ? now : at);
            await writer.WriteAsync(at > now ? now : at);
        });

    Console.WriteLine("Atualizando as estatísticas do planejador (ANALYZE)…");
    await using (var analyze = new NpgsqlCommand("ANALYZE deals, stage_changes, activities", connection))
    {
        await analyze.ExecuteNonQueryAsync();
    }

    Console.WriteLine($"Pronto. Organização: {org.Id} · Admin: {users[0].Id} · SDR: {users[1].Id}");
}

static async Task CopyAsync<T>(NpgsqlConnection connection, string copyCommand, IEnumerable<T> rows, Func<NpgsqlBinaryImporter, T, Task> write)
{
    await using var writer = await connection.BeginBinaryImportAsync(copyCommand);
    foreach (var row in rows)
    {
        await writer.StartRowAsync();
        await write(writer, row);
    }

    await writer.CompleteAsync();
}

static async Task MeasureAsync(string connectionString)
{
    await using var probe = OpenContext(connectionString);
    var org = await probe.Organizations.FirstOrDefaultAsync(o => o.Name == OrgName)
        ?? throw new InvalidOperationException($"Massa não encontrada. Rode 'dotnet run -- seed' antes.");

    var admin = await probe.Users.FirstAsync(u => u.OrganizationId == org.Id && u.Role == UserRole.Admin);
    var sdr = await probe.Users.FirstAsync(u => u.OrganizationId == org.Id && u.Role == UserRole.Sdr);

    Console.WriteLine($"Massa: {await probe.Deals.CountAsync(d => d.OrganizationId == org.Id):N0} negócios · "
        + $"{await probe.Activities.CountAsync(a => a.OrganizationId == org.Id):N0} atividades · "
        + $"{await probe.StageChanges.CountAsync(s => s.OrganizationId == org.Id):N0} transições");
    Console.WriteLine();
    Console.WriteLine($"{"cenário",-34}{"mín",8}{"p50",8}{"p95",8}");
    Console.WriteLine(new string('─', 58));

    foreach (var (name, days, user, role, scope) in new[]
    {
        ("overview days=30 · organização", 30, admin, UserRole.Admin, DealScope.Organization),
        ("overview days=180 · organização", 180, admin, UserRole.Admin, DealScope.Organization),
        ("overview days=30 · carteira (SDR)", 30, sdr, UserRole.Sdr, DealScope.Mine),
        ("overview days=180 · carteira (SDR)", 180, sdr, UserRole.Sdr, DealScope.Mine),
    })
    {
        var samples = new List<double>();
        // Amostras de sobra porque a máquina de desenvolvimento é ruidosa: o p95 oscila bastante
        // entre execuções, e é o mínimo que diz com mais honestidade quanto o trabalho custa.
        // As três primeiras rodadas ficam de fora: pagam plano de consulta e JIT.
        for (var run = 0; run < 33; run++)
        {
            // Contexto novo por rodada: sem cache de primeiro nível, como numa requisição de verdade.
            await using var db = OpenContext(connectionString);
            var currentUser = new BenchUser(user.Id, org.Id, role.ToString());
            // Provider sem cache: a medição tem que mostrar o custo do cálculo, não o de um acerto
            // de cache. O ganho do cache é a diferença entre este número e o do cenário "cache quente".
            // Um relógio só, como o escopo de DI da requisição: o fuso é lido uma vez.
            var clock = new OrganizationClock(db, currentUser);
            var handler = new GetDashboardOverviewQueryHandler(
                db, currentUser, clock, new ActivityFeedReader(db, clock), new StageAnalyticsProvider(db));

            var stopwatch = Stopwatch.StartNew();
            await handler.Handle(new GetDashboardOverviewQuery(days, scope), CancellationToken.None);
            stopwatch.Stop();

            if (run >= 3) samples.Add(stopwatch.Elapsed.TotalMilliseconds);
        }

        samples.Sort();
        Console.WriteLine($"{name,-34}{samples[0],7:N0}ms{Percentile(samples, 0.50),7:N0}ms{Percentile(samples, 0.95),7:N0}ms");
    }

    // O mesmo cenário com o cache da leitura histórica quente — a diferença para a primeira linha é
    // o ganho do item 22. O cache é compartilhado entre as rodadas; o contexto continua novo.
    foreach (var (name, days, user, role, scope) in new[]
    {
        ("overview days=30 · org · cache quente", 30, admin, UserRole.Admin, DealScope.Organization),
        ("overview days=180 · org · cache quente", 180, admin, UserRole.Admin, DealScope.Organization),
    })
    {
        var samples = new List<double>();
        using var cache = new MemoryCache(new MemoryCacheOptions());

        for (var run = 0; run < 33; run++)
        {
            await using var db = OpenContext(connectionString);
            var currentUser = new BenchUser(user.Id, org.Id, role.ToString());
            var analytics = new CachedStageAnalyticsProvider(new StageAnalyticsProvider(db), cache);
            var clock = new OrganizationClock(db, currentUser);
            var handler = new GetDashboardOverviewQueryHandler(
                db, currentUser, clock, new ActivityFeedReader(db, clock), analytics);

            var stopwatch = Stopwatch.StartNew();
            await handler.Handle(new GetDashboardOverviewQuery(days, scope), CancellationToken.None);
            stopwatch.Stop();

            if (run >= 3) samples.Add(stopwatch.Elapsed.TotalMilliseconds);
        }

        samples.Sort();
        Console.WriteLine($"{name,-34}{samples[0],7:N0}ms{Percentile(samples, 0.50),7:N0}ms{Percentile(samples, 0.95),7:N0}ms");
    }

    // O feed ("Ver todas") é a outra consulta que o item 22 manda medir.
    foreach (var (name, user, role) in new[]
    {
        ("feed primeira página · organização", admin, UserRole.Admin),
        ("feed primeira página · carteira (SDR)", sdr, UserRole.Sdr),
    })
    {
        var samples = new List<double>();
        for (var run = 0; run < 33; run++)
        {
            await using var db = OpenContext(connectionString);
            var currentUser = new BenchUser(user.Id, org.Id, role.ToString());
            var reader = new ActivityFeedReader(db, new OrganizationClock(db, currentUser));

            var stopwatch = Stopwatch.StartNew();
            await reader.ReadAsync(
                currentUser.ResolveDealScope(),
                new ActivityFeedRequest(null, [], null, 20),
                CancellationToken.None);
            stopwatch.Stop();

            if (run >= 3) samples.Add(stopwatch.Elapsed.TotalMilliseconds);
        }

        samples.Sort();
        Console.WriteLine($"{name,-34}{samples[0],7:N0}ms{Percentile(samples, 0.50),7:N0}ms{Percentile(samples, 0.95),7:N0}ms");
    }
}

/// <summary>
/// Onde o tempo do overview vai, fase a fase. Reproduz as consultas do handler isoladamente — não
/// para substituir a medição ponta a ponta, mas para dizer o que vale a pena otimizar.
/// </summary>
static async Task ProfileAsync(string connectionString)
{
    await using var probe = OpenContext(connectionString);
    var org = await probe.Organizations.FirstAsync(o => o.Name == OrgName);
    var now = DateTime.UtcNow;
    var periodStart = now.AddDays(-30);

    Console.WriteLine($"{"fase (escopo organização)",-46}{"mín",8}{"p50",8}");
    Console.WriteLine(new string('─', 62));

    await TimeAsync("carregar negócios (projeção DealRow)", async db => await db.Deals
        .AsNoTracking().Where(d => d.OrganizationId == org.Id)
        .Select(d => new { d.Id, d.CompanyId, d.Stage, d.Source, d.OwnerUserId, d.Amount, d.Ticket, d.Status, d.CreatedAt, d.ClosedAt, d.ExpectedCloseDate })
        .ToListAsync());

    await TimeAsync("carregar transições de etapa", async db => await db.StageChanges
        .AsNoTracking().Where(s => s.OrganizationId == org.Id)
        .Select(s => new { s.DealId, s.ToStage, s.ChangedAt })
        .ToListAsync());

    await TimeAsync("contar atividades (GroupBy no banco)", async db => await db.Activities
        .AsNoTracking().Where(a => a.OrganizationId == org.Id && a.OccurredAt >= periodStart && a.OccurredAt <= now)
        .GroupBy(a => new { a.Type, IsCurrent = a.OccurredAt >= periodStart })
        .Select(g => new { g.Key.Type, g.Key.IsCurrent, Count = g.Count() })
        .ToListAsync());

    await TimeAsync("carregar empresas (entidade inteira)", async db => await db.Companies
        .AsNoTracking().Where(c => c.OrganizationId == org.Id)
        .ToDictionaryAsync(c => c.Id, c => c.Name));

    await TimeAsync("carregar empresas (só id + nome)", async db => await db.Companies
        .AsNoTracking().Where(c => c.OrganizationId == org.Id)
        .Select(c => new { c.Id, c.Name })
        .ToDictionaryAsync(c => c.Id, c => c.Name));

    // A alternativa de banco para "há quanto tempo cada negócio está na etapa".
    await TimeAsync("última transição por negócio (GroupBy no banco)", async db => await db.StageChanges
        .AsNoTracking().Where(s => s.OrganizationId == org.Id)
        .GroupBy(s => s.DealId)
        .Select(g => new { DealId = g.Key, Last = g.Max(s => s.ChangedAt) })
        .ToListAsync());

    // O trabalho puramente em memória, com os dados já carregados.
    var reaches = await probe.StageChanges.AsNoTracking().Where(s => s.OrganizationId == org.Id)
        .Select(s => new StageReach(s.DealId, s.ToStage, s.ChangedAt)).ToListAsync();
    var statuses = await probe.Deals.AsNoTracking()
        .Where(d => d.OrganizationId == org.Id && d.Status != DealStatus.Aberto)
        .Select(d => new { d.Id, d.Status }).ToDictionaryAsync(d => d.Id, d => d.Status);

    TimeSync("StageAnalytics.CalculateAdvanceStats (memória)", () => StageAnalytics.CalculateAdvanceStats(reaches));
    TimeSync("StageAnalytics.CalculateWinProbabilities (memória)", () => StageAnalytics.CalculateWinProbabilities(reaches, statuses));

    async Task TimeAsync(string label, Func<MetupDbContext, Task<object>> work)
    {
        var samples = new List<double>();
        for (var run = 0; run < 13; run++)
        {
            await using var db = OpenContext(connectionString);
            var stopwatch = Stopwatch.StartNew();
            await work(db);
            stopwatch.Stop();
            if (run >= 3) samples.Add(stopwatch.Elapsed.TotalMilliseconds);
        }

        samples.Sort();
        Console.WriteLine($"{label,-46}{samples[0],7:N0}ms{Percentile(samples, 0.50),7:N0}ms");
    }

    void TimeSync(string label, Func<object> work)
    {
        var samples = new List<double>();
        for (var run = 0; run < 13; run++)
        {
            var stopwatch = Stopwatch.StartNew();
            work();
            stopwatch.Stop();
            if (run >= 3) samples.Add(stopwatch.Elapsed.TotalMilliseconds);
        }

        samples.Sort();
        Console.WriteLine($"{label,-46}{samples[0],7:N0}ms{Percentile(samples, 0.50),7:N0}ms");
    }
}

static double Percentile(List<double> sorted, double percentile) =>
    sorted[Math.Clamp((int)Math.Ceiling(percentile * sorted.Count) - 1, 0, sorted.Count - 1)];

internal sealed record BenchUser(Guid? UserId, Guid? OrganizationId, string? Role) : ICurrentUserService;
