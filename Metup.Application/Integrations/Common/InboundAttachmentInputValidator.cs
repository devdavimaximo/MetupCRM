using FluentValidation;

namespace Metup.Application.Integrations.Common;

/// <summary>Reaproveitado pelos dois endpoints de ingestão que aceitam anexo (inbound e outbound automático).</summary>
public class InboundAttachmentInputValidator : AbstractValidator<InboundAttachmentInput>
{
    public InboundAttachmentInputValidator()
    {
        RuleFor(x => x.Url)
            .NotEmpty().WithMessage("Todo anexo precisa de uma URL.")
            .Must(url => Uri.TryCreate(url, UriKind.Absolute, out _)).WithMessage("A URL do anexo precisa ser absoluta.");

        RuleFor(x => x.FileName).MaximumLength(255);
        RuleFor(x => x.MimeType).MaximumLength(127);
    }
}
