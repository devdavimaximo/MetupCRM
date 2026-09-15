using FluentValidation;
using Metup.Application.Activities.Common;

namespace Metup.Application.Activities.Queries.ListActivityFeed;

public class ListActivityFeedQueryValidator : AbstractValidator<ListActivityFeedQuery>
{
    public ListActivityFeedQueryValidator()
    {
        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, ListActivityFeedQuery.MaxPageSize)
            .WithMessage($"O tamanho da página deve ficar entre 1 e {ListActivityFeedQuery.MaxPageSize}.");

        RuleFor(x => x.Cursor)
            .Must(cursor => ActivityFeedCursor.TryDecode(cursor, out _))
            .WithMessage("Posição do feed inválida. Recarregue a lista.")
            .When(x => x.Cursor is not null);

        RuleForEach(x => x.Kinds)
            .IsInEnum().WithMessage("Tipo de evento inválido.");
    }
}
