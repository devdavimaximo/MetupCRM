using Metup.Application.Contacts.Common;
using MediatR;

namespace Metup.Application.Contacts.Queries.GetContactById;

public record GetContactByIdQuery(Guid Id) : IRequest<ContactDto>;
