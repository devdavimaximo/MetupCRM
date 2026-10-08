import type { FoundLead, LeadSearch } from "./api"

const ratingFormatter = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const compactFormatter = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 })

/** Ainda trabalhando de verdade: pedida/andando e sem estourar o prazo de resposta. */
export function isSearchActive(search: Pick<LeadSearch, "status" | "isStalled">) {
  return (search.status === "Requested" || search.status === "Running") && !search.isStalled
}

export type SearchTone = "active" | "done" | "warning" | "danger" | "muted"

export function searchState(search: Pick<LeadSearch, "status" | "isStalled">): { label: string; tone: SearchTone } {
  if (search.isStalled) return { label: "Sem resposta", tone: "warning" }
  switch (search.status) {
    case "Requested":
      return { label: "Aguardando automação", tone: "active" }
    case "Running":
      return { label: "Buscando", tone: "active" }
    case "Completed":
      return { label: "Concluída", tone: "done" }
    case "Failed":
      return { label: "Falhou", tone: "danger" }
    case "Cancelled":
      return { label: "Cancelada", tone: "muted" }
  }
}

/** "clínicas odontológicas · Curitiba, PR" — com "· sem site" quando a busca pediu só esses. */
export function searchTitle(search: Pick<LeadSearch, "query" | "location"> & Partial<Pick<LeadSearch, "withoutWebsite">>) {
  return [search.query, search.location, search.withoutWebsite ? "sem site" : null].filter(Boolean).join(" · ")
}

/** "48 encontrados · 30 novos" — o que já estava na base não conta como novo. */
export function searchProgress(search: Pick<LeadSearch, "receivedCount" | "newCount" | "status">) {
  if (search.receivedCount === 0) return search.status === "Requested" ? "Na fila da automação" : "Nenhum resultado ainda"
  const found = `${search.receivedCount} ${search.receivedCount === 1 ? "encontrado" : "encontrados"}`
  const fresh = `${search.newCount} ${search.newCount === 1 ? "novo" : "novos"}`
  return `${found} · ${fresh}`
}

/** "odontovida.com.br" a partir de "https://www.odontovida.com.br/contato". */
export function websiteLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

export function formatRating(rating: number) {
  return ratingFormatter.format(rating)
}

/** "312" · "1,2 mil". */
export function formatReviewCount(count: number) {
  return count < 1000 ? String(count) : compactFormatter.format(count)
}

/** O link do lugar na fonte; sem ele, uma busca no Maps por nome + endereço. */
export function mapsHref(lead: Pick<FoundLead, "mapsUrl" | "name" | "address" | "city">) {
  if (lead.mapsUrl) return lead.mapsUrl
  const query = [lead.name, lead.address ?? lead.city].filter(Boolean).join(", ")
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

/** Endereço curto para a tabela: o logradouro, com a cidade quando ela não está no texto. */
export function shortAddress(lead: Pick<FoundLead, "address" | "city" | "state">) {
  const place = [lead.city, lead.state].filter(Boolean).join(" - ")
  if (!lead.address) return place || null
  if (!lead.city || lead.address.toLowerCase().includes(lead.city.toLowerCase())) return lead.address
  return `${lead.address} · ${place}`
}

/**
 * Celular brasileiro (DDD + 9 + 8 dígitos) — o único caso em que vale oferecer WhatsApp. Fixo de
 * comércio quase nunca tem WhatsApp, e o botão errado custa um clique perdido por linha.
 */
export function isLikelyMobile(phone: string | null) {
  if (!phone) return false
  const digits = phone.replace(/\D/g, "")
  const national = digits.length > 11 && digits.startsWith("55") ? digits.slice(2) : digits
  return national.length === 11 && national[2] === "9"
}
