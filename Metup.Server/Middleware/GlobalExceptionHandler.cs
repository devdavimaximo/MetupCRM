using FluentValidation;
using Metup.Application.Common.Exceptions;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace Metup.Server.Middleware;

public class GlobalExceptionHandler : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        var (statusCode, title, errors) = exception switch
        {
            ValidationException validationException => (
                StatusCodes.Status400BadRequest,
                "Erro de validação",
                ToErrors(validationException)),
            InvalidCredentialsException => (
                StatusCodes.Status401Unauthorized,
                exception.Message,
                null),
            MissingOrganizationScopeException => (
                StatusCodes.Status401Unauthorized,
                exception.Message,
                null),
            NotFoundException => (
                StatusCodes.Status404NotFound,
                exception.Message,
                null),
            _ => (StatusCodes.Status500InternalServerError, "Erro interno do servidor", null),
        };

        var problemDetails = new ProblemDetails
        {
            Status = statusCode,
            Title = title,
        };

        if (errors is not null)
        {
            problemDetails.Extensions["errors"] = errors;
        }

        httpContext.Response.StatusCode = statusCode;
        await httpContext.Response.WriteAsJsonAsync(problemDetails, cancellationToken);

        return true;
    }

    private static IDictionary<string, string[]> ToErrors(ValidationException exception) =>
        exception.Errors
            .GroupBy(e => e.PropertyName)
            .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray());
}
