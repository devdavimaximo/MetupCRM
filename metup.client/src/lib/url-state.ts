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
    conversationTab: params.get("conversaAba") ?? "",
    conversationChannels: params.get("conversaCanal") ?? "",
    conversationStatuses: params.get("conversaStatus") ?? "",
    segment: params.get("segmento") ?? "",
    city: params.get("cidade") ?? "",
    ownerUserId: params.get("responsavel") ?? "",
    source: params.get("origem") ?? "",
    taskStatus: params.get("status") ?? "",
    dueFrom: params.get("prazoDe") ?? "",
    dueTo: params.get("prazoAte") ?? "",
    tasksTab: params.get("aba") ?? "",
    tasksPage: params.get("pagina") ?? "",
    tasksPageSize: params.get("porPagina") ?? "",
    tasksDate: params.get("data") ?? "",
    reportPeriod: params.get("relatorioPeriodo") ?? "",
    reportFrom: params.get("relatorioDe") ?? "",
    reportTo: params.get("relatorioAte") ?? "",
    reportTab: params.get("relatorioAba") ?? "",
    dashboardScope: params.get("escopo") ?? "",
    dashboardPeriod: params.get("periodo") ?? "",
    dashboardFrom: params.get("de") ?? "",
    dashboardTo: params.get("ate") ?? "",
    pipelineStage: params.get("etapa") ?? "",
    activityFeed: params.get("feed") ?? "",
    dealSection: params.get("acao") ?? "",
    pipelinePeriod: params.get("quadroPeriodo") ?? "",
    pipelineFrom: params.get("quadroDe") ?? "",
    pipelineTo: params.get("quadroAte") ?? "",
    pipelineSearch: params.get("quadroBusca") ?? "",
    pipelineSources: params.get("origens") ?? "",
    pipelineSegments: params.get("segmentos") ?? "",
    pipelineSort: params.get("ordem") ?? "",
    pipelineClosed: params.get("fechados") ?? "",
    pipelineStalled: params.get("parados") ?? "",
    pipelineList: params.get("lista") ?? "",
    pipelineMonths: params.get("evolucao") ?? "",
  }
}

type UrlStatePatch = {
  view?: View
  search?: string
  companyId?: string | null
  dealId?: string | null
  conversationId?: string | null
  conversationTab?: string
  conversationChannels?: string
  conversationStatuses?: string
  segment?: string
  city?: string
  ownerUserId?: string
  source?: string
  taskStatus?: string
  dueFrom?: string
  dueTo?: string
  tasksTab?: string
  tasksPage?: string
  tasksPageSize?: string
  tasksDate?: string
  reportPeriod?: string
  reportFrom?: string
  reportTo?: string
  reportTab?: string
  dashboardScope?: string
  dashboardPeriod?: string
  dashboardFrom?: string
  dashboardTo?: string
  pipelineStage?: string
  activityFeed?: string
  dealSection?: string
  pipelinePeriod?: string
  pipelineFrom?: string
  pipelineTo?: string
  pipelineSearch?: string
  pipelineSources?: string
  pipelineSegments?: string
  pipelineSort?: string
  pipelineClosed?: string
  pipelineStalled?: string
  pipelineList?: string
  pipelineMonths?: string
}

const STRING_KEYS = [
  ["search", "busca"],
  ["conversationTab", "conversaAba"],
  ["conversationChannels", "conversaCanal"],
  ["conversationStatuses", "conversaStatus"],
  ["segment", "segmento"],
  ["city", "cidade"],
  ["ownerUserId", "responsavel"],
  ["source", "origem"],
  ["taskStatus", "status"],
  ["dueFrom", "prazoDe"],
  ["dueTo", "prazoAte"],
  ["tasksTab", "aba"],
  ["tasksPage", "pagina"],
  ["tasksPageSize", "porPagina"],
  ["tasksDate", "data"],
  ["reportPeriod", "relatorioPeriodo"],
  ["reportFrom", "relatorioDe"],
  ["reportTo", "relatorioAte"],
  ["reportTab", "relatorioAba"],
  ["dashboardScope", "escopo"],
  ["dashboardPeriod", "periodo"],
  ["dashboardFrom", "de"],
  ["dashboardTo", "ate"],
  ["pipelineStage", "etapa"],
  ["activityFeed", "feed"],
  ["dealSection", "acao"],
  ["pipelinePeriod", "quadroPeriodo"],
  ["pipelineFrom", "quadroDe"],
  ["pipelineTo", "quadroAte"],
  ["pipelineSearch", "quadroBusca"],
  ["pipelineSources", "origens"],
  ["pipelineSegments", "segmentos"],
  ["pipelineSort", "ordem"],
  ["pipelineClosed", "fechados"],
  ["pipelineStalled", "parados"],
  ["pipelineList", "lista"],
  ["pipelineMonths", "evolucao"],
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
