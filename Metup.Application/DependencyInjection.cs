using FluentValidation;
using Metup.Application.Activities.Common;
using Metup.Application.Common.Behaviors;
using Metup.Application.Deals.Analytics;
using Metup.Application.Deals.Common;
using MediatR;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;

namespace Metup.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddMediatR(config =>
        {
            config.RegisterServicesFromAssembly(typeof(DependencyInjection).Assembly);
            // A medição envolve a validação: o que o log reporta é o custo real da requisição.
            config.AddOpenBehavior(typeof(PerformanceBehavior<,>));
            config.AddOpenBehavior(typeof(ValidationBehavior<,>));
        });

        services.AddValidatorsFromAssembly(typeof(DependencyInjection).Assembly);

        services.AddScoped<ActivityFeedReader>();
        services.AddScoped<DealBoardReader>();

        // A leitura histórica do funil é a parte cara do dashboard e envelhece devagar: o cálculo
        // fica no provider, e o cache por escopo entra como decorador por cima dele.
        services.AddMemoryCache();
        services.AddScoped<StageAnalyticsProvider>();
        services.AddScoped<IStageAnalyticsProvider>(sp =>
            new CachedStageAnalyticsProvider(sp.GetRequiredService<StageAnalyticsProvider>(), sp.GetRequiredService<IMemoryCache>()));

        return services;
    }
}
