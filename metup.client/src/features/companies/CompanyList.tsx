import { Building2, Loader2, Plus, Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { CompanyListItem } from "./api"

type Props = {
  companies: CompanyListItem[]
  totalCount: number
  selectedId: string | null
  search: string
  isLoading: boolean
  error: string | null
  onSearchChange: (search: string) => void
  onSelect: (companyId: string) => void
  onCreate: () => void
  onRetry: () => void
}

export function CompanyList({
  companies,
  totalCount,
  selectedId,
  search,
  isLoading,
  error,
  onSearchChange,
  onSelect,
  onCreate,
  onRetry,
}: Props) {
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

        <Button type="button" onClick={onCreate} className="w-full">
          <Plus aria-hidden="true" />
          Nova Empresa
        </Button>
      </div>

      <p className="tabular text-xs text-muted-foreground" aria-live="polite">
        {isLoading
          ? "Carregando…"
          : `${totalCount} ${totalCount === 1 ? "empresa" : "empresas"}${search ? " encontradas" : ""}`}
      </p>

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
        <EmptyState search={search} onCreate={onCreate} onClearSearch={() => onSearchChange("")} />
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
  search,
  onCreate,
  onClearSearch,
}: {
  search: string
  onCreate: () => void
  onClearSearch: () => void
}) {
  if (search) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-border px-4 py-6">
        <p className="text-sm text-muted-foreground">
          Nenhuma empresa encontrada para “{search}”.
        </p>
        <Button type="button" size="sm" variant="outline" onClick={onClearSearch}>
          Limpar Busca
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
