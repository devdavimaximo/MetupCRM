using FluentValidation;
using Metup.Application.Deals.Common;
using MediatR;

namespace Metup.Application.Deals.Commands.ReassignDeal;

/// <summary>Passa o negócio para outro responsável da organização. Só Admin/Closer, e só negócio aberto.</summary>
public record ReassignDealCommand(Guid Id, Guid OwnerUserId) : IRequest<DealDto>;

public class ReassignDealCommandValidator : AbstractValidator<ReassignDealCommand>
{
    public ReassignDealCommandValidator()
    {
        RuleFor(x => x.OwnerUserId)
            .NotEmpty().WithMessage("Informe o novo responsável.");
    }
}
