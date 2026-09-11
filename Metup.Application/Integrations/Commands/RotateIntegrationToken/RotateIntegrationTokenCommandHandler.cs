using System.Security.Cryptography;
using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Integrations.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Integrations.Commands.RotateIntegrationToken;

/// <summary>
/// Emite (ou substitui) o service token do n8n para a organização do usuário logado. Só Admin
/// (checado no controller) — o token não fica em texto puro em lugar nenhum do banco, só o hash
/// (regra "segredos das integrações ficam no n8n", seção 10 do CLAUDE.md; aqui é o CRM emitindo
/// a credencial que o sócio vai colar na configuração do n8n).
/// </summary>
public class RotateIntegrationTokenCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    IPasswordHasher passwordHasher) : IRequestHandler<RotateIntegrationTokenCommand, RotateIntegrationTokenResult>
{
    public async Task<RotateIntegrationTokenResult> Handle(RotateIntegrationTokenCommand request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();

        var organization = await context.Organizations
            .Where(o => o.Id == organizationId)
            .FirstOrDefaultAsync(cancellationToken);
        if (organization is null)
        {
            throw new NotFoundException("Organização");
        }

        var secret = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        organization.IntegrationTokenHash = passwordHasher.Hash(secret);

        await context.SaveChangesAsync(cancellationToken);

        return new RotateIntegrationTokenResult(ServiceTokenFormat.Combine(organizationId, secret));
    }
}
