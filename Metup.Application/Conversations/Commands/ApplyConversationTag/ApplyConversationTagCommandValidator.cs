using FluentValidation;
using Metup.Domain.Conversations;

namespace Metup.Application.Conversations.Commands.ApplyConversationTag;

public class ApplyConversationTagCommandValidator : AbstractValidator<ApplyConversationTagCommand>
{
    public ApplyConversationTagCommandValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Informe o nome da tag.")
            .MaximumLength(ConversationTagOption.NameMaxLength);
    }
}
