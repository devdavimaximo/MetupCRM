using FluentValidation;
using Hangfire;
using Hangfire.PostgreSql;
using MediatR;
using Metup.Application.Common.Behaviors;
using Metup.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not configured.");

builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddSignalR();

builder.Services.AddDbContext<MetupDbContext>(options => options.UseNpgsql(connectionString));

builder.Services.AddMediatR(config =>
{
    config.RegisterServicesFromAssembly(typeof(ValidationBehavior<,>).Assembly);
    config.AddOpenBehavior(typeof(ValidationBehavior<,>));
});
builder.Services.AddValidatorsFromAssembly(typeof(ValidationBehavior<,>).Assembly);

builder.Services.AddHangfire(config => config.UsePostgreSqlStorage(options => options.UseNpgsqlConnection(connectionString)));
builder.Services.AddHangfireServer();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

if (app.Environment.IsDevelopment())
{
    app.UseHangfireDashboard();
}

app.Run();
