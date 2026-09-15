import { Building2, Search, UserRound, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Monogram } from "@/components/ui/monogram"
import { Select } from "@/components/ui/select"
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/states"
import { numberFormatter } from "@/lib/format"
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
    <div className="flex min-h-0 w-full flex-col">
      <div className="flex flex-col gap-2 border-b border-line-soft p-3">
        <Label htmlFor="company-search" className="sr-only">
          Buscar empresa
        </Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <Input
            id="company-search"
            type="search"
            name="search"
            className="h-9 pl-9"
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
              className="h-9"
              value={segment}
              onChange={(e) => onSegmentChange(e.target.value)}
            >
              <option value="">Segmento</option>
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
            <Select
              id="company-filter-city"
              className="h-9"
              value={city}
              onChange={(e) => onCityChange(e.target.value)}
            >
              <option value="">Cidade</option>
              {filterOptions.cities.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-line-soft/60 px-4">
        <p className="label-mono text-muted" aria-live="polite">
          {isLoading ? "Carregando…" : `${numberFormatter.format(totalCount)} ${totalCount === 1 ? "empresa" : "empresas"}`}
        </p>
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="label-mono inline-flex cursor-pointer items-center gap-1 rounded-xs text-muted hover:text-fg focus-visible:focus-ring"
          >
            <X className="size-3" aria-hidden="true" />
            Limpar
          </button>
        )}
      </div>

      {error && (
        <div className="p-3">
          <Alert onRetry={onRetry}>{error}</Alert>
        </div>
      )}

      {isLoading && companies.length === 0 && <SkeletonRows rows={7} label="Carregando empresas…" />}

      {!isLoading && !error && companies.length === 0 && (
        <EmptyState
          compact
          icon={Building2}
          title={hasFilters ? "Nenhuma empresa encontrada" : "Nenhuma empresa cadastrada"}
          description={
            hasFilters
              ? "Nada bate com essa busca e esses filtros."
              : "Comece pela primeira empresa-alvo da prospecção."
          }
          action={
            hasFilters ? (
              <Button type="button" size="sm" variant="outline" onClick={clearFilters}>
                Limpar filtros
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={onCreate}>
                Nova empresa
              </Button>
            )
          }
        />
      )}

      {companies.length > 0 && (
        <ul className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain py-1", isLoading && "opacity-60")}>
          {companies.map((company) => {
            const isSelected = company.id === selectedId
            return (
              <li key={company.id} className="px-1.5">
                <button
                  type="button"
                  onClick={() => onSelect(company.id)}
                  aria-current={isSelected ? "true" : undefined}
                  className={cn(
                    "relative flex w-full cursor-pointer items-center gap-3 rounded-xs px-2.5 py-2.5 text-left transition-colors focus-visible:focus-ring",
                    isSelected ? "bg-surface-2" : "hover:bg-surface-2/60"
                  )}
                >
                  {isSelected && <span aria-hidden="true" className="absolute top-2 bottom-2 -left-1.5 w-0.5 bg-accent" />}
                  <Monogram name={company.name} size="sm" className={cn(isSelected && "border-accent/40 text-accent")} />

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-medium text-fg">{company.name}</span>
                    <span className="block truncate text-sm text-muted">
                      {[company.segment, company.city].filter(Boolean).join(" · ") || "Sem segmento"}
                    </span>
                  </span>

                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 font-mono text-2xs tabular",
                      company.contactCount > 0 ? "text-fg-muted" : "text-faint"
                    )}
                  >
                    <UserRound className="size-3" aria-hidden="true" />
                    {company.contactCount}
                    <span className="sr-only">{company.contactCount === 1 ? " contato" : " contatos"}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
