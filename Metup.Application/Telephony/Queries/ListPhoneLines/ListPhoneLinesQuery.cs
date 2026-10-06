using Metup.Application.Telephony.Common;
using MediatR;

namespace Metup.Application.Telephony.Queries.ListPhoneLines;

/// <summary>Todas as linhas da organização, ativas e desativadas — a tela de administração.</summary>
public record ListPhoneLinesQuery : IRequest<IReadOnlyList<PhoneLineDto>>;

/// <summary>As linhas ativas do usuário logado — as que ele pode usar no discador.</summary>
public record ListMyPhoneLinesQuery : IRequest<IReadOnlyList<PhoneLineDto>>;
