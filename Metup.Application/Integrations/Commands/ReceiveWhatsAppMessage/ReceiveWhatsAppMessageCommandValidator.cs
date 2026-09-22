using FluentValidation;
using Metup.Application.Integrations.Common;

namespace Metup.Application.Integrations.Commands.ReceiveWhatsAppMessage;

public class ReceiveWhatsAppMessageCommandValidator : AbstractValidator<ReceiveWhatsAppMessageCommand>
{
    public ReceiveWhatsAppMessageCommandValidator()
    {
        RuleFor(x => x.FromWhatsApp)
            .NotEmpty().WithMessage("Informe o número de WhatsApp de origem.")
            .MaximumLength(40);

        RuleFor(x => x.Body)
            .NotEmpty().WithMessage("A mensagem não pode chegar vazia.")
            .MaximumLength(4096);

        RuleFor(x => x.ExternalMessageId).MaximumLength(200);
        RuleFor(x => x.ExternalConversationId).MaximumLength(200);

        RuleForEach(x => x.Attachments).SetValidator(new InboundAttachmentInputValidator());
    }
}
