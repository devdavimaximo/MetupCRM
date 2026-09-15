export type View = "dashboard" | "empresas" | "pipeline" | "tarefas" | "inbox" | "relatorios"

const VIEWS: View[] = ["dashboard", "empresas", "pipeline", "tarefas", "inbox", "relatorios"]

/**
 * Estado navegável na URL (aba ativa, busca, filtros e fichas abertas), para o SDR poder
 * recarregar a página ou mandar o link de uma tela filtrada sem perder o contexto.
 */
export function readUrlState() {
  const params = new URLSearchParams(window.location.search)
  const vista = params.get("vista")
  return {
    view: (VIEWS.includes(vista as View) ? vista : "dashboard") as View,
    search: params.get("busca") ?? "",
    companyId: params.get("empresa"),
    dealId: params.get("negocio"),
    conversationId: params.get("conversa"),
    segment: params.get("segmento") ?? "",
    city: params.get("cidade") ?? "",
    ownerUserId: params.get("responsavel") ?? "",
    source: params.get("origem") ?? "",
    taskStatus: params.get("status") ?? "",
    dueFrom: params.get("prazoDe") ?? "",
    dueTo: params.get("prazoAte") ?? "",
    reportFrom: params.get("relatorioDe") ?? "",
    reportTo: params.get("relatorioAte") ?? "",
    reportTab: params.get("relatorioAba") ?? "",
    dashboardScope: params.get("escopo") ?? "",
  }
}

type UrlStatePatch = {
  view?: View
  search?: string
  companyId?: string | null
  dealId?: string | null
  conversationId?: string | null
  segment?: string
  city?: string
  ownerUserId?: string
  source?: string
  taskStatus?: string
  dueFrom?: string
  dueTo?: string
  reportFrom?: string
  reportTo?: string
  reportTab?: string
  dashboardScope?: string
}

const STRING_KEYS = [
  ["search", "busca"],
  ["segment", "segmento"],
  ["city", "cidade"],
  ["ownerUserId", "responsavel"],
  ["source", "origem"],
  ["taskStatus", "status"],
  ["dueFrom", "prazoDe"],
  ["dueTo", "prazoAte"],
  ["reportFrom", "relatorioDe"],
  ["reportTo", "relatorioAte"],
  ["reportTab", "relatorioAba"],
  ["dashboardScope", "escopo"],
] as const

/** Só mexe nas chaves informadas — cada tela cuida do próprio pedaço da URL sem apagar o resto. */
export function writeUrlState(state: UrlStatePatch) {
  const params = new URLSearchParams(window.location.search)

  if (state.view !== undefined) {
    if (state.view === "dashboard") params.delete("vista")
    else params.set("vista", state.view)
  }

  for (const [key, param] of STRING_KEYS) {
    const value = state[key]
    if (value === undefined) continue
    if (value) params.set(param, value)
    else params.delete(param)
  }

  if (state.companyId !== undefined) {
    if (state.companyId) params.set("empresa", state.companyId)
    else params.delete("empresa")
  }

  if (state.dealId !== undefined) {
    if (state.dealId) params.set("negocio", state.dealId)
    else params.delete("negocio")
  }

  if (state.conversationId !== undefined) {
    if (state.conversationId) params.set("conversa", state.conversationId)
    else params.delete("conversa")
  }

  const query = params.toString()
  window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname)
}
