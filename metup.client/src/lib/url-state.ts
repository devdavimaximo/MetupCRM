export type View = "empresas" | "pipeline" | "tarefas"

const VIEWS: View[] = ["empresas", "pipeline", "tarefas"]

/**
 * Estado navegável na URL (aba ativa, busca, empresa e negócio abertos), para o SDR poder
 * recarregar a página ou mandar o link de uma ficha sem perder o contexto.
 */
export function readUrlState() {
  const params = new URLSearchParams(window.location.search)
  const vista = params.get("vista")
  return {
    view: (VIEWS.includes(vista as View) ? vista : "empresas") as View,
    search: params.get("busca") ?? "",
    companyId: params.get("empresa"),
    dealId: params.get("negocio"),
  }
}

type UrlStatePatch = {
  view?: View
  search?: string
  companyId?: string | null
  dealId?: string | null
}

/** Só mexe nas chaves informadas — cada tela cuida do próprio pedaço da URL sem apagar o resto. */
export function writeUrlState(state: UrlStatePatch) {
  const params = new URLSearchParams(window.location.search)

  if (state.view !== undefined) {
    if (state.view === "empresas") params.delete("vista")
    else params.set("vista", state.view)
  }

  if (state.search !== undefined) {
    if (state.search) params.set("busca", state.search)
    else params.delete("busca")
  }

  if (state.companyId !== undefined) {
    if (state.companyId) params.set("empresa", state.companyId)
    else params.delete("empresa")
  }

  if (state.dealId !== undefined) {
    if (state.dealId) params.set("negocio", state.dealId)
    else params.delete("negocio")
  }

  const query = params.toString()
  window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname)
}
