using Metup.Application.Common.Interfaces;
using Metup.Application.Common.Realtime;
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

        services.AddDbContext<MetupDbContext>(options => options.UseNpgsql(connectionString));
        services.AddScoped<IApplicationDbContext>(provider => provider.GetRequiredService<MetupDbContext>());

        services.Configure<JwtSettings>(configuration.GetSection(JwtSettings.SectionName));
        services.AddScoped<IPasswordHasher, PasswordHasher>();
        services.AddScoped<ITokenService, JwtTokenService>();
        services.AddScoped<IOrganizationClock, OrganizationClock>();
        services.AddScoped<ITextSearch, NpgsqlTextSearch>();

        // Tempo real das telas: um handler para os cinco avisos in-process publicados pelos comandos.
        services.AddTransient<INotificationHandler<DealCreatedNotification>, DashboardRealtimeNotifier>();
        services.AddTransient<INotificationHandler<DealStageChangedNotification>, DashboardRealtimeNotifier>();
        services.AddTransient<INotificationHandler<DealClosedNotification>, DashboardRealtimeNotifier>();
        services.AddTransient<INotificationHandler<ActivityLoggedNotification>, DashboardRealtimeNotifier>();
        services.AddTransient<INotificationHandler<TaskCompletedNotification>, DashboardRealtimeNotifier>();

        return services;
    }
}
