using Metup.Application.Contacts.Common;
using MediatR;

namespace Metup.Application.Contacts.Queries.ListContactsByCompany;

public record ListContactsByCompanyQuery(Guid CompanyId) : IRequest<IReadOnlyList<ContactDto>>;
