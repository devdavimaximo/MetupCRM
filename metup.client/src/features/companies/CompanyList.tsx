import { Building2, Loader2, Plus, Search, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { CompanyFilterOptions, CompanyListItem } from "./api"

type Props = {
  companies: CompanyListItem[]
  totalCount: number
  selectedId: string | null
  search: string
  segment: string
  city: string
  filterOptions: CompanyFilterOptions
  isLoading: boolean
  error: string | null
  onSearchChange: (search: string) => void
  onSegmentChange: (segment: string) => void
  onCityChange: (city: string) => void
  onSelect: (companyId: string) => void
  onCreate: () => void
  onRetry: () => void
}

export function CompanyList({
  companies,
  totalCount,
  selectedId,
  search,
  segment,
  city,
  filterOptions,
  isLoading,
  error,
  onSearchChange,
  onSegmentChange,
  onCityChange,
  onSelect,
  onCreate,
  onRetry,
}: Props) {
  const hasFilters = Boolean(search || segment || city)

  function clearFilters() {
    onSearchChange("")
    onSegmentChange("")
    onCityChange("")
  }

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="company-search" className="sr-only">
          Buscar empresa
        </Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="company-search"
            type="search"
            name="search"
            className="pl-9"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nome, segmento ou cidade…"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="company-filter-segment" className="sr-only">
              Filtrar por segmento
            </Label>
            <Select
              id="company-filter-segment"
              value={segment}
              onChange={(e) => onSegmentChange(e.target.value)}
            >
              <option value="">Todos os segmentos</option>
              {filterOptions.segments.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="company-filter-city" className="sr-only">
              Filtrar por cidade
            </Label>
            <Select id="company-filter-city" value={city} onChange={(e) => onCityChange(e.target.value)}>
              <option value="">Todas as cidades</option>
              {filterOptions.cities.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <Button type="button" onClick={onCreate} className="w-full">
          <Plus aria-hidden="true" />
          Nova Empresa
        </Button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="tabular text-xs text-muted-foreground" aria-live="polite">
          {isLoading
            ? "Carregando…"
            : `${totalCount} ${totalCount === 1 ? "empresa" : "empresas"}${hasFilters ? " encontradas" : ""}`}
        </p>
        {hasFilters && (
          <Button type="button" size="sm" variant="ghost" className="h-auto p-0 text-xs" onClick={clearFilters}>
            <X className="size-3" aria-hidden="true" />
            Limpar filtros
          </Button>
        )}
      </div>

      {error && (
        <div role="alert" className="flex flex-col items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5">
          <p className="text-sm font-medium text-destructive">{error}</p>
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            Tentar de Novo
          </Button>
        </div>
      )}

      {isLoading && companies.length === 0 && (
        <p className="flex items-center gap-2 px-1 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Carregando empresas…
        </p>
      )}

      {!isLoading && !error && companies.length === 0 && (
        <EmptyState hasFilters={hasFilters} onCreate={onCreate} onClearFilters={clearFilters} />
      )}

      {companies.length > 0 && (
        <ul className="-mx-1 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-1">
          {companies.map((company) => {
            const isSelected = company.id === selectedId
            return (
              <li key={company.id}>
                <button
                  type="button"
                  onClick={() => onSelect(company.id)}
                  aria-current={isSelected ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors outline-none",
                    "focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    isSelected
                      ? "border-primary bg-accent"
                      : "border-transparent hover:border-border hover:bg-muted"
                  )}
                >
                  <Building2
                    className={cn(
                      "size-4 shrink-0",
                      isSelected ? "text-primary" : "text-muted-foreground"
                    )}
                    aria-hidden="true"
                  />

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {company.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[company.segment, company.city].filter(Boolean).join(" · ") || "Sem segmento"}
                    </span>
                  </span>

                  <Badge variant={company.contactCount > 0 ? "default" : "outline"} className="tabular">
                    {company.contactCount}
                    <span className="sr-only">
                      {company.contactCount === 1 ? " contato" : " contatos"}
                    </span>
                  </Badge>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function EmptyState({
  hasFilters,
  onCreate,
  onClearFilters,
}: {
  hasFilters: boolean
  onCreate: () => void
  onClearFilters: () => void
}) {
  if (hasFilters) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-border px-4 py-6">
        <p className="text-sm text-muted-foreground">Nenhuma empresa encontrada para esses filtros.</p>
        <Button type="button" size="sm" variant="outline" onClick={onClearFilters}>
          Limpar Filtros
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-border px-4 py-6">
      <p className="text-sm text-muted-foreground">
        Nenhuma empresa cadastrada ainda. Comece pela primeira empresa-alvo da prospecção.
      </p>
      <Button type="button" size="sm" onClick={onCreate}>
        <Plus aria-hidden="true" />
        Nova Empresa
      </Button>
    </div>
  )
}
