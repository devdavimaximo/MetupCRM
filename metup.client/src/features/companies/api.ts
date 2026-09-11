import { apiFetch } from "@/lib/api"

export type Contact = {
  id: string
  companyId: string
  name: string
  role: string | null
  phone: string | null
  whatsApp: string | null
  email: string | null
}

export type Company = {
  id: string
  name: string
  segment: string | null
  city: string | null
  instagram: string | null
  phone: string | null
  contacts: Contact[]
}

export type CompanyListItem = {
  id: string
  name: string
  segment: string | null
  city: string | null
  phone: string | null
  contactCount: number
}

export type PagedResult<T> = {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

export type CompanyInput = {
  name: string
  segment: string | null
  city: string | null
  instagram: string | null
  phone: string | null
}

export type ContactInput = {
  name: string
  role: string | null
  phone: string | null
  whatsApp: string | null
  email: string | null
}

/** A organização nunca é enviada: o servidor a resolve pelo token. */
export function listCompanies(
  params: { search?: string; page?: number; pageSize?: number },
  signal?: AbortSignal
) {
  const query = new URLSearchParams()
  if (params.search) query.set("search", params.search)
  query.set("page", String(params.page ?? 1))
  query.set("pageSize", String(params.pageSize ?? 50))

  return apiFetch<PagedResult<CompanyListItem>>(`/api/companies?${query}`, { signal })
}

export function getCompany(id: string, signal?: AbortSignal) {
  return apiFetch<Company>(`/api/companies/${id}`, { signal })
}

export function createCompany(input: CompanyInput) {
  return apiFetch<Company>("/api/companies", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function updateCompany(id: string, input: CompanyInput) {
  return apiFetch<Company>(`/api/companies/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  })
}

export function createContact(companyId: string, input: ContactInput) {
  return apiFetch<Contact>(`/api/companies/${companyId}/contacts`, {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function updateContact(id: string, input: ContactInput) {
  return apiFetch<Contact>(`/api/contacts/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  })
}
