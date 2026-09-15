using FluentValidation;
using Metup.Domain.Organizations;

namespace Metup.Application.Organizations.Commands.UpdateOrganizationSettings;

public class UpdateOrganizationSettingsCommandValidator : AbstractValidator<UpdateOrganizationSettingsCommand>
{
    public UpdateOrganizationSettingsCommandValidator()
    {
        RuleFor(x => x.StalledDealDays)
            .InclusiveBetween(Organization.MinStalledDealDays, Organization.MaxStalledDealDays)
            .WithMessage(
                $"O limite de negócio parado deve ficar entre {Organization.MinStalledDealDays} e {Organization.MaxStalledDealDays} dias.");
    }
}
