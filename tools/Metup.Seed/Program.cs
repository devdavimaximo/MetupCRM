// Ferramenta de desenvolvimento: gera uma massa de dados fictícia (organização "Metup Demo")
// para visualizar o sistema e o dashboard com dados mockados. Usa o MetupDbContext e os métodos
// de domínio diretamente (Deal.Create/ChangeStage/Close, Activity.Log, TaskItem.Create) para que
// a massa gerada respeite as mesmas regras do produto real (histórico de estágio, desfecho
// estruturado etc.). Reexecutável: apaga a organização "Metup Demo" anterior antes de recriar.
using Metup.Domain.Activities;
using Metup.Domain.Companies;
using Metup.Domain.Contacts;
using Metup.Domain.Conversations;
using Metup.Domain.Deals;
using Metup.Domain.Organizations;
using Metup.Domain.Tasks;
using Metup.Domain.Users;
using Metup.Infrastructure.Persistence;
using Metup.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;

const string connectionString = "Host=localhost;Port=5432;Database=metup_crm;Username=postgres;Password=29102022";
const string sharedPassword = "Metup@2026";
const string orgName = "Metup Demo";
const int totalDeals = 500;

var rng = new Random(20260914);
var hasher = new PasswordHasher();
var now = DateTime.UtcNow;

var optionsBuilder = new DbContextOptionsBuilder<MetupDbContext>();
optionsBuilder.UseNpgsql(connectionString);

await using var db = new MetupDbContext(optionsBuilder.Options);

Console.WriteLine("Aplicando migrations pendentes...");
await db.Database.MigrateAsync();

var previousOrg = await db.Organizations.FirstOrDefaultAsync(o => o.Name == orgName);
if (previousOrg is not null)
{
    Console.WriteLine("Removendo massa anterior da organização 'Metup Demo'...");
    var orgId = previousOrg.Id;
    await db.Messages.Where(m => m.OrganizationId == orgId).ExecuteDeleteAsync();
    await db.Conversations.Where(c => c.OrganizationId == orgId).ExecuteDeleteAsync();
    await db.TaskReschedules.Where(r => r.OrganizationId == orgId).ExecuteDeleteAsync();
    await db.Tasks.Where(t => t.OrganizationId == orgId).ExecuteDeleteAsync();
    await db.Activities.Where(a => a.OrganizationId == orgId).ExecuteDeleteAsync();
    await db.StageChanges.Where(s => s.OrganizationId == orgId).ExecuteDeleteAsync();
    await db.DealValueChanges.Where(v => v.OrganizationId == orgId).ExecuteDeleteAsync();
    await db.Deals.Where(d => d.OrganizationId == orgId).ExecuteDeleteAsync();
    await db.Contacts.Where(c => c.OrganizationId == orgId).ExecuteDeleteAsync();
    await db.Companies.Where(c => c.OrganizationId == orgId).ExecuteDeleteAsync();
    await db.IntegrationEvents.Where(e => e.OrganizationId == orgId).ExecuteDeleteAsync();
    await db.Users.Where(u => u.OrganizationId == orgId).ExecuteDeleteAsync();
    await db.Organizations.Where(o => o.Id == orgId).ExecuteDeleteAsync();
}

Console.WriteLine("Criando organização e usuários...");

var org = new Organization { Name = orgName };

var admin = new User
{
    OrganizationId = org.Id,
    Name = "Davi Maximo",
    Email = "admin@metup.com.br",
    PasswordHash = hasher.Hash(sharedPassword),
    Role = UserRole.Admin,
};
var sdrAna = new User
{
    OrganizationId = org.Id,
    Name = "Ana Souza",
    Email = "ana.sdr@metup.com.br",
    PasswordHash = hasher.Hash(sharedPassword),
    Role = UserRole.Sdr,
};
var sdrBruno = new User
{
    OrganizationId = org.Id,
    Name = "Bruno Lima",
    Email = "bruno.sdr@metup.com.br",
    PasswordHash = hasher.Hash(sharedPassword),
    Role = UserRole.Sdr,
};
var closerCarla = new User
{
    OrganizationId = org.Id,
    Name = "Carla Ribeiro",
    Email = "carla.closer@metup.com.br",
    PasswordHash = hasher.Hash(sharedPassword),
    Role = UserRole.Closer,
};

db.Organizations.Add(org);
db.Users.AddRange(admin, sdrAna, sdrBruno, closerCarla);
await db.SaveChangesAsync();

// ---- Dados de referência para geração --------------------------------------------------

string[] companyPrefixes =
[
    "Vitta", "Nova", "Prime", "Central", "Grupo", "Studio", "Casa", "Ponto", "Bella", "Alto",
    "Real", "União", "Sul", "Norte", "Mais", "Only", "Smart", "Next", "Vero", "Urban", "Bravo",
    "Lumen", "Aura", "Zenith", "Aqua", "Terra", "Flow", "Alpha", "Trend", "Bright",
];
string[] segments =
[
    "E-commerce", "Clínica Odontológica", "Academia", "Restaurante", "Imobiliária",
    "Escritório de Advocacia", "Agência de Marketing", "Loja de Roupas", "Petshop",
    "Escola de Idiomas", "Salão de Beleza", "Consultoria Financeira", "Construtora",
    "Distribuidora", "Studio de Pilates", "Clínica de Estética", "Barbearia", "Farmácia",
    "Contabilidade", "Autoescola",
];
Dictionary<string, string[]> segmentSuffixes = new()
{
    ["E-commerce"] = ["Store", "Shop", "Commerce"],
    ["Clínica Odontológica"] = ["Odonto", "Sorriso", "Dental"],
    ["Academia"] = ["Fit", "Box", "Training"],
    ["Restaurante"] = ["Sabor", "Cozinha", "Gastronomia"],
    ["Imobiliária"] = ["Imóveis", "Realty", "Empreendimentos"],
    ["Escritório de Advocacia"] = ["Advocacia", "Advogados Associados", "Legal"],
    ["Agência de Marketing"] = ["Ads", "Digital", "Growth"],
    ["Loja de Roupas"] = ["Moda", "Boutique", "Wear"],
    ["Petshop"] = ["Pet", "Animal", "Bicho"],
    ["Escola de Idiomas"] = ["Idiomas", "Languages", "English"],
    ["Salão de Beleza"] = ["Beauty", "Hair", "Salão"],
    ["Consultoria Financeira"] = ["Capital", "Finance", "Investimentos"],
    ["Construtora"] = ["Construtora", "Engenharia", "Empreendimentos"],
    ["Distribuidora"] = ["Distribuidora", "Atacado", "Supply"],
    ["Studio de Pilates"] = ["Pilates", "Studio", "Movimento"],
    ["Clínica de Estética"] = ["Estética", "Derma", "Clinic"],
    ["Barbearia"] = ["Barber", "Barbearia", "Style"],
    ["Farmácia"] = ["Farma", "Saúde", "Pharma"],
    ["Contabilidade"] = ["Contábil", "Contabilidade", "Assessoria"],
    ["Autoescola"] = ["Autoescola", "CNH", "Direção"],
};
string[] cities =
[
    "São Paulo", "Rio de Janeiro", "Belo Horizonte", "Curitiba", "Porto Alegre",
    "Florianópolis", "Campinas", "Goiânia", "Salvador", "Recife", "Brasília", "Fortaleza",
];
string[] ddds = ["11", "21", "31", "41", "51", "48", "19", "62", "71", "81", "61", "85"];
string[] firstNames =
[
    "Ana", "Bruno", "Carla", "Diego", "Elisa", "Fábio", "Gabriela", "Hugo", "Isabela", "João",
    "Karina", "Leonardo", "Mariana", "Nicolas", "Olívia", "Pedro", "Queila", "Rafael", "Sabrina",
    "Thiago", "Ursula", "Vinícius", "Wesley", "Yasmin", "Camila", "Eduardo", "Fernanda", "Gustavo",
];
string[] lastNames =
[
    "Silva", "Souza", "Oliveira", "Santos", "Pereira", "Costa", "Rodrigues", "Almeida",
    "Nascimento", "Lima", "Araújo", "Fernandes", "Carvalho", "Gomes", "Martins", "Rocha",
    "Ribeiro", "Alves", "Monteiro", "Cardoso",
];
string[] roles =
[
    "Sócio-proprietário", "Gerente Comercial", "Diretor de Marketing", "Coordenador de Vendas",
    "Sócia-fundadora", "Gerente Geral", "Head de Growth", "Proprietário", "CEO",
    "Responsável Financeiro",
];
string[] whatsAppInboundSamples =
[
    "Oi, vi o anúncio de vocês, pode me passar mais informações?",
    "Quanto fica o investimento?",
    "Legal, me manda uma proposta então.",
    "Consigo marcar uma call essa semana?",
    "Ok, vou analisar com o sócio e te retorno.",
];
string[] whatsAppOutboundSamples =
[
    "Oi! Tudo bem? Vi que vocês têm interesse em melhorar a captação de clientes.",
    "Claro, te explico rapidinho como funciona.",
    "Consigo te mandar a proposta ainda hoje.",
    "Perfeito, que tal quinta às 15h?",
    "Fico no aguardo, qualquer dúvida me chama por aqui.",
];

var users = new[] { admin, sdrAna, sdrBruno, closerCarla };

User PickOwner()
{
    var roll = rng.Next(100);
    return roll < 30 ? admin : roll < 55 ? sdrAna : roll < 80 ? sdrBruno : closerCarla;
}

DealSource PickSource()
{
    var roll = rng.Next(100);
    return roll < 70 ? DealSource.Sdr : roll < 90 ? DealSource.WhatsApp : DealSource.MetaAds;
}

decimal RandomTicket() => rng.Next(20, 250) * 100m;

string Slugify(string value) => value.ToLowerInvariant()
    .Replace(" ", "")
    .Replace("ã", "a").Replace("á", "a").Replace("â", "a")
    .Replace("é", "e").Replace("ê", "e")
    .Replace("í", "i")
    .Replace("ó", "o").Replace("õ", "o")
    .Replace("ú", "u")
    .Replace("ç", "c");

(string Name, string Segment, string City, string? Instagram, string? Phone) GenerateCompany()
{
    var segment = segments[rng.Next(segments.Length)];
    var suffix = segmentSuffixes[segment][rng.Next(segmentSuffixes[segment].Length)];
    var name = $"{companyPrefixes[rng.Next(companyPrefixes.Length)]} {suffix}";
    var city = cities[rng.Next(cities.Length)];
    var ddd = ddds[rng.Next(ddds.Length)];
    var phone = $"({ddd}) 9{rng.Next(1000, 9999)}-{rng.Next(1000, 9999)}";
    var instagram = rng.Next(100) < 70 ? $"@{Slugify(name)}" : null;
    return (name, segment, city, instagram, phone);
}

(string Name, string Role, string Phone, string WhatsApp, string Email) GenerateContact(string companyName)
{
    var first = firstNames[rng.Next(firstNames.Length)];
    var last = lastNames[rng.Next(lastNames.Length)];
    var name = $"{first} {last}";
    var role = roles[rng.Next(roles.Length)];
    var ddd = ddds[rng.Next(ddds.Length)];
    var phone = $"({ddd}) 9{rng.Next(1000, 9999)}-{rng.Next(1000, 9999)}";
    var email = $"{Slugify(first)}.{Slugify(last)}@{Slugify(companyName)}.com.br";
    return (name, role, phone, phone, email);
}

DateTime Step(DateTime from, int minDays, int maxDays)
{
    var candidate = from.AddDays(rng.Next(minDays, maxDays + 1)).AddHours(rng.Next(1, 10));
    return candidate > now ? now : candidate;
}

DateTime PendingDueDate() => now.AddDays(rng.Next(-5, 8)).Date.AddHours(rng.Next(8, 19));

string CallNote(ActivityOutcome outcome) => outcome switch
{
    ActivityOutcome.NaoAtendeu => "Não atendeu, tentar novamente.",
    ActivityOutcome.NumeroInvalido => "Número inválido / fora de serviço.",
    ActivityOutcome.PediuRetorno => "Pediu para retornar em outro momento.",
    ActivityOutcome.Atendeu => "Atendeu, breve conversa.",
    ActivityOutcome.SemInteresse => "Sem interesse no momento.",
    ActivityOutcome.Interessado => "Demonstrou interesse, avançar contato.",
    ActivityOutcome.ReuniaoAgendada => "Reunião agendada.",
    _ => string.Empty,
};

StageChange ChangeStage(Deal deal, DealStage stage, Guid byUserId, DateTime at)
{
    var change = deal.ChangeStage(stage, byUserId, at);
    db.StageChanges.Add(change);
    return change;
}

StageChange CloseDeal(Deal deal, bool won, decimal? amount, Guid byUserId, DateTime at)
{
    // Perdido sempre tem motivo; o sorteio espalha os motivos para a métrica "por que perdemos".
    LostReason? lostReason = won ? null : Enum.GetValues<LostReason>()[rng.Next(Enum.GetValues<LostReason>().Length)];
    var closure = deal.Close(won, amount, lostReason, null, byUserId, at);
    db.StageChanges.Add(closure.StageChange);
    if (closure.ValueChange is { } valueChange)
    {
        db.DealValueChanges.Add(valueChange);
    }

    return closure.StageChange;
}

Activity LogActivity(Deal deal, Guid contactId, ActivityType type, ActivityOutcome? outcome, string note, Guid authorId, DateTime at)
{
    var activity = Activity.Log(org.Id, deal.Id, contactId, type, outcome, note, authorId, at);
    db.Activities.Add(activity);
    return activity;
}

TaskItem AddTask(Deal deal, ActivityType type, DateTime due, Guid ownerId, string note)
{
    var task = TaskItem.Create(org.Id, deal.Id, type, due, ownerId, note);
    db.Tasks.Add(task);
    return task;
}

void SeedConversation(Guid contactId, Guid dealId, Guid ownerId, DealStage stageAtMessage, DateTime around)
{
    var conversation = Conversation.Create(org.Id, contactId, ConversationChannel.WhatsApp);
    db.Conversations.Add(conversation);

    var messageCount = rng.Next(2, 7);
    var t = around.AddDays(-rng.Next(0, 2));
    Message? last = null;
    for (var i = 0; i < messageCount; i++)
    {
        t = t.AddHours(rng.Next(1, 6));
        if (t > now)
        {
            t = now;
        }

        var inbound = i % 2 == 0;
        var body = inbound
            ? whatsAppInboundSamples[rng.Next(whatsAppInboundSamples.Length)]
            : whatsAppOutboundSamples[rng.Next(whatsAppOutboundSamples.Length)];

        last = inbound
            ? Message.ReceiveInbound(org.Id, conversation.Id, body, null, dealId, stageAtMessage, t)
            : Message.SendOutbound(org.Id, conversation.Id, body, ownerId, dealId, stageAtMessage, t);
        db.Messages.Add(last);
    }

    conversation.LastMessageAt = last?.OccurredAt;
}

// ---- Distribuição do funil (mesmo exemplo da seção 2 do CLAUDE.md) ---------------------
// 500 prospects -> 312 ligações -> 87 conversas -> 24 reuniões -> 11 propostas -> 4 clientes.

var shuffled = Enumerable.Range(0, totalDeals).OrderBy(_ => rng.Next()).ToList();
var called = shuffled.Take(312).ToList();
var conversed = called.Take(87).ToList();
var met = conversed.Take(24).ToList();
var proposed = met.Take(11).ToList();
var won = proposed.Take(4).ToList();

var wonSet = won.ToHashSet();
var proposedSet = proposed.ToHashSet();
var metSet = met.ToHashSet();
var conversedSet = conversed.ToHashSet();
var calledSet = called.ToHashSet();

Console.WriteLine($"Gerando {totalDeals} prospects/negócios com timeline completa...");

void ProcessDeal(int i)
{
    var (companyName, segment, city, instagram, companyPhone) = GenerateCompany();
    var company = new Company
    {
        OrganizationId = org.Id,
        Name = companyName,
        Segment = segment,
        City = city,
        Instagram = instagram,
        Phone = companyPhone,
    };
    db.Companies.Add(company);

    var (contactName, contactRole, contactPhone, contactWhatsApp, contactEmail) = GenerateContact(companyName);
    var contact = new Contact
    {
        OrganizationId = org.Id,
        CompanyId = company.Id,
        Name = contactName,
        Role = contactRole,
        Phone = contactPhone,
        WhatsApp = contactWhatsApp,
        Email = contactEmail,
    };
    db.Contacts.Add(contact);

    var owner = PickOwner();
    var source = PickSource();
    var ticket = RandomTicket();

    var isCalled = calledSet.Contains(i);
    var isConversed = conversedSet.Contains(i);
    var isMet = metSet.Contains(i);
    var isProposed = proposedSet.Contains(i);
    var isWon = wonSet.Contains(i);

    var createdAt = isWon ? now.AddDays(-rng.Next(35, 150))
        : isProposed ? now.AddDays(-rng.Next(25, 130))
        : isMet ? now.AddDays(-rng.Next(18, 110))
        : isConversed ? now.AddDays(-rng.Next(10, 95))
        : isCalled ? now.AddDays(-rng.Next(5, 65))
        : now.AddDays(-rng.Next(0, 20));

    var deal = Deal.Create(org.Id, company.Id, contact.Id, DealStage.Prospect, source, owner.Id, ticket, null, owner.Id, createdAt);
    db.Deals.Add(deal);

    if (!isCalled)
    {
        // Prospect puro: ainda não recebeu a primeira ligação.
        if (rng.Next(100) < 60)
        {
            AddTask(deal, ActivityType.Call, PendingDueDate(), owner.Id, "Primeira ligação de prospecção.");
        }

        return;
    }

    var t1 = Step(createdAt, 0, 5);
    if (!isConversed)
    {
        var outcomeRoll = rng.Next(100);
        var outcome = outcomeRoll < 55 ? ActivityOutcome.NaoAtendeu
            : outcomeRoll < 75 ? ActivityOutcome.NumeroInvalido
            : ActivityOutcome.PediuRetorno;

        LogActivity(deal, contact.Id, ActivityType.Call, outcome, CallNote(outcome), owner.Id, t1);
        ChangeStage(deal, DealStage.PrimeiroContato, owner.Id, t1);

        if (rng.Next(100) < 70)
        {
            CloseDeal(deal, false, null, owner.Id, Step(t1, 1, 10));
        }
        else
        {
            AddTask(deal, ActivityType.Call, PendingDueDate(), owner.Id, "Tentar contato novamente.");
        }

        return;
    }

    // Conversou: primeiro contato tentado, depois atendeu/demonstrou interesse.
    LogActivity(deal, contact.Id, ActivityType.Call, ActivityOutcome.PediuRetorno, CallNote(ActivityOutcome.PediuRetorno), owner.Id, t1);
    ChangeStage(deal, DealStage.PrimeiroContato, owner.Id, t1);

    var t2 = Step(t1, 1, 6);
    var conversationOutcome = isMet ? ActivityOutcome.ReuniaoAgendada : ActivityOutcome.Interessado;
    LogActivity(deal, contact.Id, ActivityType.Call, conversationOutcome, CallNote(conversationOutcome), owner.Id, t2);
    ChangeStage(deal, DealStage.ContatoRealizado, owner.Id, t2);

    if (source == DealSource.WhatsApp || rng.Next(100) < 45)
    {
        SeedConversation(contact.Id, deal.Id, owner.Id, DealStage.ContatoRealizado, t2);
    }

    var lastStageAt = t2;
    if (rng.Next(100) < 50)
    {
        lastStageAt = Step(t2, 0, 4);
        LogActivity(deal, contact.Id, ActivityType.Note, null, "Levantamento de necessidades e orçamento.", owner.Id, lastStageAt);
        ChangeStage(deal, DealStage.Qualificacao, owner.Id, lastStageAt);
    }

    if (!isMet)
    {
        if (rng.Next(100) < 60)
        {
            CloseDeal(deal, false, null, owner.Id, Step(lastStageAt, 1, 12));
        }
        else
        {
            AddTask(deal, ActivityType.WhatsApp, PendingDueDate(), owner.Id, "Follow-up da conversa.");
        }

        return;
    }

    var t3 = Step(lastStageAt, 1, 8);
    LogActivity(deal, contact.Id, ActivityType.Meeting, null, "Reunião realizada, apresentação da Metup.", owner.Id, t3);
    ChangeStage(deal, DealStage.Reuniao, owner.Id, t3);

    if (!isProposed)
    {
        if (rng.Next(100) < 60)
        {
            CloseDeal(deal, false, null, owner.Id, Step(t3, 1, 15));
        }
        else
        {
            AddTask(deal, ActivityType.Proposal, PendingDueDate(), owner.Id, "Enviar proposta comercial.");
        }

        return;
    }

    var t4 = Step(t3, 1, 7);
    LogActivity(deal, contact.Id, ActivityType.Proposal, null, $"Proposta enviada: R$ {ticket:N2}.", owner.Id, t4);
    ChangeStage(deal, DealStage.Proposta, owner.Id, t4);

    var lastBeforeClose = t4;
    if (rng.Next(100) < 50)
    {
        lastBeforeClose = Step(t4, 1, 6);
        ChangeStage(deal, DealStage.Negociacao, owner.Id, lastBeforeClose);
    }

    if (isWon)
    {
        var factor = 0.8m + (decimal)rng.NextDouble() * 0.4m;
        var closedAmount = Math.Round(ticket * factor, 2);
        CloseDeal(deal, true, closedAmount, owner.Id, Step(lastBeforeClose, 1, 10));
    }
    else if (rng.Next(100) < 70)
    {
        CloseDeal(deal, false, null, owner.Id, Step(lastBeforeClose, 1, 10));
    }
    else
    {
        AddTask(deal, ActivityType.WhatsApp, PendingDueDate(), owner.Id, "Follow-up da proposta enviada.");
    }
}

for (var i = 0; i < totalDeals; i++)
{
    ProcessDeal(i);

    if ((i + 1) % 25 == 0)
    {
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        Console.WriteLine($"  {i + 1}/{totalDeals} negócios processados...");
    }
}

await db.SaveChangesAsync();

Console.WriteLine();
Console.WriteLine("Massa de dados gerada com sucesso.");
Console.WriteLine();
Console.WriteLine("== Resumo do funil ==");
var stageCounts = await db.Deals
    .Where(d => d.OrganizationId == org.Id)
    .GroupBy(d => d.Stage)
    .Select(g => new { Stage = g.Key, Count = g.Count() })
    .ToListAsync();
foreach (var stage in Enum.GetValues<DealStage>())
{
    var count = stageCounts.FirstOrDefault(s => s.Stage == stage)?.Count ?? 0;
    Console.WriteLine($"  {stage,-16} {count}");
}

var statusCounts = await db.Deals
    .Where(d => d.OrganizationId == org.Id)
    .GroupBy(d => d.Status)
    .Select(g => new { Status = g.Key, Count = g.Count() })
    .ToListAsync();
Console.WriteLine();
foreach (var status in statusCounts)
{
    Console.WriteLine($"  status {status.Status,-10} {status.Count}");
}

var wonRevenue = await db.Deals
    .Where(d => d.OrganizationId == org.Id && d.Status == DealStatus.Ganho)
    .SumAsync(d => d.Amount ?? 0);
Console.WriteLine($"  receita fechada (Ganho): R$ {wonRevenue:N2}");

Console.WriteLine();
Console.WriteLine("== Tarefas pendentes por responsável ==");
var pendingByOwner = await db.Tasks
    .Where(t => t.OrganizationId == org.Id && t.Status == TaskItemStatus.Pendente)
    .GroupBy(t => t.OwnerUserId)
    .Select(g => new { OwnerUserId = g.Key, Count = g.Count() })
    .ToListAsync();
foreach (var user in users)
{
    var count = pendingByOwner.FirstOrDefault(p => p.OwnerUserId == user.Id)?.Count ?? 0;
    Console.WriteLine($"  {user.Name,-14} {count}");
}

var adminOverdue = await db.Tasks.CountAsync(t => t.OrganizationId == org.Id && t.OwnerUserId == admin.Id
    && t.Status == TaskItemStatus.Pendente && t.DueDate < now);
var adminToday = await db.Tasks.CountAsync(t => t.OrganizationId == org.Id && t.OwnerUserId == admin.Id
    && t.Status == TaskItemStatus.Pendente && t.DueDate >= now.Date && t.DueDate <= now.Date.AddDays(1).AddTicks(-1));
var adminUpcoming = await db.Tasks.CountAsync(t => t.OrganizationId == org.Id && t.OwnerUserId == admin.Id
    && t.Status == TaskItemStatus.Pendente && t.DueDate > now.Date.AddDays(1).AddTicks(-1));
Console.WriteLine($"  admin: {adminOverdue} atrasadas | {adminToday} hoje | {adminUpcoming} futuras");

var conversationCount = await db.Conversations.CountAsync(c => c.OrganizationId == org.Id);
var messageCount = await db.Messages.CountAsync(m => m.OrganizationId == org.Id);
Console.WriteLine();
Console.WriteLine($"Inbox: {conversationCount} conversas, {messageCount} mensagens.");
Console.WriteLine();
Console.WriteLine("== Contas de login (todas com a mesma senha) ==");
foreach (var user in users)
{
    Console.WriteLine($"  {user.Role,-6} | {user.Email} | senha: {sharedPassword}");
}
Console.WriteLine();
Console.WriteLine("Use a conta admin@metup.com.br para ver o sistema por inteiro (dashboard, pipeline, relatórios).");
