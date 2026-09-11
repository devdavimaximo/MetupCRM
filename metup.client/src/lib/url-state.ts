/**
 * Estado navegável na URL (busca e empresa aberta), para o SDR poder
 * recarregar a página ou mandar o link de uma ficha sem perder o contexto.
 */
export function readUrlState() {
  const params = new URLSearchParams(window.location.search)
  return {
    search: params.get("busca") ?? "",
    companyId: params.get("empresa"),
  }
}

export function writeUrlState(state: { search: string; companyId: string | null }) {
  const params = new URLSearchParams(window.location.search)

  if (state.search) params.set("busca", state.search)
  else params.delete("busca")

  if (state.companyId) params.set("empresa", state.companyId)
  else params.delete("empresa")

  const query = params.toString()
  window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname)
}
