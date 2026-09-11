using FluentValidation;

namespace Metup.Application.Conversations.Commands.SendMessage;

public class SendMessageCommandValidator : AbstractValidator<SendMessageCommand>
{
    public SendMessageCommandValidator()
    {
        RuleFor(x => x.Body)
            .NotEmpty().WithMessage("Escreva uma mensagem.")
            .MaximumLength(4096);
    }
}
