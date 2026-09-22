using FluentValidation;
using Metup.Application.Integrations.Common;

namespace Metup.Application.Integrations.Commands.ReceiveAutomatedOutboundMessage;

public class ReceiveAutomatedOutboundMessageCommandValidator : AbstractValidator<ReceiveAutomatedOutboundMessageCommand>
{
    public ReceiveAutomatedOutboundMessageCommandValidator()
    {
        RuleFor(x => x.ToWhatsApp)
            .NotEmpty().WithMessage("Informe o número de WhatsApp de destino.")
            .MaximumLength(40);

        RuleFor(x => x.Body)
            .NotEmpty().WithMessage("A mensagem não pode chegar vazia.")
            .MaximumLength(4096);

        RuleFor(x => x.ExternalMessageId).MaximumLength(200);

        RuleForEach(x => x.Attachments).SetValidator(new InboundAttachmentInputValidator());
    }
}
