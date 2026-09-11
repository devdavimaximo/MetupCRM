using Metup.Domain.Users;

namespace Metup.Application.Users.Common;

/// <summary>Linha enxuta de usuário — hoje só para popular seletores (responsável do negócio).</summary>
public record UserSummaryDto(Guid Id, string Name, UserRole Role);
