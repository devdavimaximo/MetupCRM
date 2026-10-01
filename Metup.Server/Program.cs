using System.Text;
using System.Text.Json.Serialization;
using Hangfire;
using Hangfire.PostgreSql;
using Metup.Application;
using Metup.Application.Common.Interfaces;
using Metup.Infrastructure;
using Metup.Infrastructure.Persistence;
using Metup.Infrastructure.Realtime;
using Metup.Infrastructure.Security;
using Metup.Server.Middleware;
using Metup.Server.Security;
using Metup.Server.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not configured.");

var corsOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];

builder.Services.AddControllers()
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddOpenApi();
builder.Services.AddSignalR();

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("Client", policy =>
    {
        policy.WithOrigins(corsOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var jwtSettings = builder.Configuration.GetSection(JwtSettings.SectionName).Get<JwtSettings>()
    ?? throw new InvalidOperationException("Jwt settings not configured.");

// HMAC-SHA256 exige chave de pelo menos 256 bits; falhar no boot é melhor que um 500 no primeiro login.
if (Encoding.UTF8.GetByteCount(jwtSettings.Secret ?? string.Empty) < 32)
{
    throw new InvalidOperationException("Jwt:Secret must be at least 32 bytes long.");
}

// Em produção a aplicação roda atrás do proxy do EasyPanel (Traefik), que termina o HTTPS. Os
// cabeçalhos X-Forwarded-* restauram esquema e IP do cliente; a rede do proxy não é fixa dentro
// do Docker, por isso as listas de confiança são limpas (o container só é exposto pelo proxy).
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

builder.Services.AddHealthChecks();

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtSettings.Issuer,
            ValidateAudience = true,
            ValidAudience = jwtSettings.Audience,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.Secret)),
            ClockSkew = TimeSpan.Zero,
        };

        // WebSocket não manda header Authorization: o client do SignalR envia o mesmo JWT como
        // access_token na query string. Aceito só no caminho do hub, nunca nos endpoints da API.
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(accessToken) && context.HttpContext.Request.Path.StartsWithSegments(DashboardHub.Path))
                {
                    context.Token = accessToken;
                }

                return Task.CompletedTask;
            },
        };
    })
    .AddScheme<AuthenticationSchemeOptions, ServiceTokenAuthenticationHandler>(
        ServiceTokenAuthenticationHandler.SchemeName, _ => { });

builder.Services.AddAuthorization();

builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

builder.Services.AddHangfire(config => config.UsePostgreSqlStorage(options => options.UseNpgsqlConnection(connectionString)));
builder.Services.AddHangfireServer();

var app = builder.Build();

if (app.Configuration.GetValue("Database:MigrateOnStartup", defaultValue: true))
{
    await app.Services.MigrateDatabaseAsync();
}

app.UseForwardedHeaders();
app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

// Em produção o build do front (metup.client/dist) é copiado para wwwroot: mesma origem que a
// API e o hub, então não há CORS nem URL de API embutida no bundle.
app.UseDefaultFiles();
app.UseStaticFiles();

// Explícito e depois dos estáticos: sem isso o roteamento roda no início do pipeline, o fallback
// do SPA casa com /assets/*.js e o middleware de estáticos (que ignora requisições com endpoint
// já escolhido) devolve index.html no lugar do bundle.
app.UseRouting();

app.UseCors("Client");
app.UseAuthentication();
app.UseMiddleware<UserAccessMiddleware>();
app.UseAuthorization();
app.MapControllers();
app.MapHub<DashboardHub>(DashboardHub.Path).RequireCors("Client");

app.MapHealthChecks("/health");

if (app.Environment.IsDevelopment())
{
    app.UseHangfireDashboard();
}

// Rotas do React Router caem no index.html; /api e /hubs ficam de fora para que um endpoint
// inexistente continue respondendo 404 em vez de devolver a página.
app.MapFallbackToFile("{*path:regex(^(?!api/|hubs/).*$)}", "index.html");

await app.RunAsync();
