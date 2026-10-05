using Metup.Application.Common.Interfaces;
using Metup.Application.Common.Realtime;
using Metup.Infrastructure.Integrations;
using Metup.Infrastructure.Realtime;
using Metup.Infrastructure.Search;
using MediatR;
using Metup.Infrastructure.Persistence;
using Metup.Infrastructure.Security;
using Metup.Infrastructure.Time;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Metup.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not configured.");

        services.AddScoped<ITenantContext, CurrentUserTenantContext>();
        services.AddDbContext<MetupDbContext>(options => options.UseNpgsql(connectionString));
        services.AddScoped<IApplicationDbContext>(provider => provider.GetRequiredService<MetupDbContext>());

        services.Configure<JwtSettings>(configuration.GetSection(JwtSettings.SectionName));
        services.AddScoped<IPasswordHasher, PasswordHasher>();
        services.AddScoped<ITokenService, JwtTokenService>();
        services.Configure<RegistrationSettings>(configuration.GetSection(RegistrationSettings.SectionName));
        services.AddSingleton<IRegistrationPolicy, RegistrationPolicy>();
        services.AddScoped<IOrganizationClock, OrganizationClock>();
        services.AddScoped<ITextSearch, NpgsqlTextSearch>();
        services.AddScoped<ICompanyPhoneLookup, NpgsqlCompanyPhoneLookup>();

        // Buscador de leads: o pedido sai para o webhook do n8n em background, com novas tentativas.
        services.AddScoped<ILeadSearchDispatcher, HangfireLeadSearchDispatcher>();
        services.AddScoped<LeadSearchWebhookJob>();
        services.AddHttpClient(LeadSearchWebhookJob.HttpClientName, client => client.Timeout = TimeSpan.FromSeconds(15));

        // Tempo real das telas: um handler para todos os avisos in-process publicados pelos comandos.
        services.AddTransient<INotificationHandler<DealCreatedNotification>, DashboardRealtimeNotifier>();
        services.AddTransient<INotificationHandler<DealStageChangedNotification>, DashboardRealtimeNotifier>();
        services.AddTransient<INotificationHandler<DealClosedNotification>, DashboardRealtimeNotifier>();
        services.AddTransient<INotificationHandler<ActivityLoggedNotification>, DashboardRealtimeNotifier>();
        services.AddTransient<INotificationHandler<TaskCompletedNotification>, DashboardRealtimeNotifier>();
        services.AddTransient<INotificationHandler<ConversationMessageReceivedNotification>, DashboardRealtimeNotifier>();
        services.AddTransient<INotificationHandler<ConversationMessageSentNotification>, DashboardRealtimeNotifier>();
        services.AddTransient<INotificationHandler<ConversationStatusChangedNotification>, DashboardRealtimeNotifier>();
        services.AddTransient<INotificationHandler<ConversationFavoritedNotification>, DashboardRealtimeNotifier>();
        services.AddTransient<INotificationHandler<LeadSearchUpdatedNotification>, DashboardRealtimeNotifier>();

        return services;
    }
}
