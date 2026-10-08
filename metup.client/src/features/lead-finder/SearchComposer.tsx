import { useState, type FormEvent } from "react"
import { Loader2, MapPin, Radar, RotateCcw, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { controlClasses } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { toFieldErrors, toMessage } from "@/features/companies/form-errors"
import { cn } from "@/lib/utils"
import { requestLeadSearch, type LeadSearch } from "./api"
import { searchTitle } from "./lead-format"

const RESULT_OPTIONS = [20, 50, 100, 200] as const

/** Sugestões de partida quando ainda não há histórico — clicar só preenche, nunca dispara. */
const STARTER_NICHES = ["clínicas odontológicas", "academias", "imobiliárias", "escritórios de advocacia", "restaurantes"]

/**
 * A frase que antes ia para o agente no n8n, agora dentro do CRM: nicho + região + quantos. Enviar
 * só grava o pedido — quem garimpa é a automação, e o resultado chega na tabela em tempo real.
 */
export function SearchComposer({
  recent,
  onRequested,
}: {
  recent: LeadSearch[]
  onRequested: (search: LeadSearch) => void
}) {
  const [query, setQuery] = useState("")
  const [location, setLocation] = useState("")
  const [maxResults, setMaxResults] = useState<number>(50)
  const [withoutWebsite, setWithoutWebsite] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [queryError, setQueryError] = useState<string | null>(null)

  // Repetir uma busca recente: as combinações distintas mais novas, sem duplicar.
  const repeatable = recent
    .filter(
      (s, index, all) =>
        all.findIndex((o) => o.query === s.query && o.location === s.location && o.withoutWebsite === s.withoutWebsite) === index,
    )
    .slice(0, 4)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (query.trim().length < 3) {
      setQueryError("Descreva o nicho com pelo menos 3 letras.")
      return
    }

    setBusy(true)
    setError(null)
    setQueryError(null)
    try {
      const search = await requestLeadSearch({
        query: query.trim(),
        location: location.trim() || null,
        maxResults,
        withoutWebsite,
      })
      onRequested(search)
      setQuery("")
    } catch (err) {
      const fields = toFieldErrors(err)
      if (fields.query) setQueryError(fields.query)
      else setError(toMessage(err, "Não foi possível pedir a busca."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="overflow-hidden">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4 px-4 py-5 sm:px-5">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_8.5rem_auto] md:items-end">
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="lead-query">O que você procura?</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                id="lead-query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="clínicas odontológicas, academias, pet shops…"
                autoComplete="off"
                maxLength={200}
                aria-invalid={queryError ? true : undefined}
                aria-describedby={queryError ? "lead-query-error" : undefined}
                className={cn(controlClasses, "h-11 pl-9")}
              />
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="lead-location">Onde?</Label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                id="lead-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Cidade, bairro ou região"
                autoComplete="off"
                maxLength={200}
                className={cn(controlClasses, "h-11 pl-9")}
              />
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="lead-max">Até</Label>
            <Select id="lead-max" value={maxResults} onChange={(e) => setMaxResults(Number(e.target.value))} className="h-11">
              {RESULT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} leads
                </option>
              ))}
            </Select>
          </div>

          <Button type="submit" size="lg" disabled={busy} className="max-md:w-full">
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Radar aria-hidden="true" />}
            Buscar leads
          </Button>
        </div>

        <label className="-mt-1 inline-flex w-fit cursor-pointer items-start gap-2 text-sm text-fg-muted">
          <input
            type="checkbox"
            checked={withoutWebsite}
            onChange={(e) => setWithoutWebsite(e.target.checked)}
            className="mt-0.5 size-4 accent-accent"
          />
          <span>
            <span className="font-medium text-fg">Só empresas sem site</span>
            <span className="block text-xs text-muted">A busca demora mais e pode trazer menos que o pedido.</span>
          </span>
        </label>

        {queryError && (
          <p id="lead-query-error" role="alert" className="-mt-2 text-xs font-medium text-danger">
            {queryError}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="label-mono mr-1 text-muted">{repeatable.length > 0 ? "Repetir" : "Ideias"}</span>
          {repeatable.length > 0
            ? repeatable.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setQuery(s.query)
                    setLocation(s.location ?? "")
                    if (s.maxResults) setMaxResults(s.maxResults)
                    setWithoutWebsite(s.withoutWebsite)
                  }}
                  className="inline-flex h-8 max-w-full cursor-pointer items-center gap-1.5 rounded-xs border border-line-soft bg-surface-2 px-2.5 text-sm text-fg-muted transition-colors hover:border-line-strong hover:text-fg focus-visible:focus-ring"
                >
                  <RotateCcw className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
                  <span className="truncate">{searchTitle(s)}</span>
                </button>
              ))
            : STARTER_NICHES.map((niche) => (
                <button
                  key={niche}
                  type="button"
                  onClick={() => setQuery(niche)}
                  className="inline-flex h-8 cursor-pointer items-center rounded-xs border border-line-soft bg-surface-2 px-2.5 text-sm text-fg-muted transition-colors hover:border-line-strong hover:text-fg focus-visible:focus-ring"
                >
                  {niche}
                </button>
              ))}
        </div>
      </form>
    </Card>
  )
}
