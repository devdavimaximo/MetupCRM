import { useCallback, useEffect, useState } from "react"
import { Building2, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Page, PageHeader } from "@/components/ui/page"
import { Alert, EmptyState, Skeleton } from "@/components/ui/states"
import { pluralize } from "@/lib/format"
import { useDebouncedValue } from "@/lib/hooks"
import { readUrlState, writeUrlState } from "@/lib/url-state"
import { cn } from "@/lib/utils"
import { CompanyList } from "./CompanyList"
import { CompanySheet } from "./CompanySheet"
import {
  getCompany,
  listCompanies,
  listCompanyFilterOptions,
  type Company,
  type CompanyFilterOptions,
  type CompanyListItem,
} from "./api"
import { toMessage } from "./form-errors"

/** Ficha aberta: uma empresa carregada, ou o formulário em branco de cadastro. */
type Selection = { mode: "none" } | { mode: "new" } | { mode: "company"; id: string }

type Props = {
  onOpenDeal: (dealId: string) => void
  onNewDealForCompany: (companyId: string, companyName: string) => void
}

export function CompaniesPage({ onOpenDeal, onNewDealForCompany }: Props) {
  const initialUrlState = readUrlState()

  const [search, setSearch] = useState(initialUrlState.search)
  const debouncedSearch = useDebouncedValue(search)
  const [segment, setSegment] = useState(initialUrlState.segment)
  const [city, setCity] = useState(initialUrlState.city)

  const [filterOptions, setFilterOptions] = useState<CompanyFilterOptions>({ segments: [], cities: [] })

  const [companies, setCompanies] = useState<CompanyListItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isListLoading, setIsListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [listVersion, setListVersion] = useState(0)

  const [selection, setSelection] = useState<Selection>(
    initialUrlState.companyId ? { mode: "company", id: initialUrlState.companyId } : { mode: "none" }
  )
  const [company, setCompany] = useState<Company | null>(null)
  const [sheetError, setSheetError] = useState<string | null>(null)

  const reloadList = useCallback(() => setListVersion((version) => version + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    listCompanyFilterOptions(controller.signal)
      .then(setFilterOptions)
      .catch(() => undefined)
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setIsListLoading(true)
    setListError(null)

    listCompanies({ search: debouncedSearch, segment, city }, controller.signal)
      .then((result) => {
        setCompanies(result.items)
        setTotalCount(result.totalCount)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setListError(toMessage(error, "Não foi possível carregar as empresas."))
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsListLoading(false)
      })

    return () => controller.abort()
  }, [debouncedSearch, segment, city, listVersion])

  const selectedId = selection.mode === "company" ? selection.id : null

  useEffect(() => {
    if (!selectedId) {
      setCompany(null)
      setSheetError(null)
      return
    }

    const controller = new AbortController()
    setSheetError(null)

    getCompany(selectedId, controller.signal)
      .then(setCompany)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setCompany(null)
        setSheetError(toMessage(error, "Não foi possível carregar a ficha da empresa."))
      })

    return () => controller.abort()
  }, [selectedId])

  useEffect(() => {
    writeUrlState({ search, segment, city, companyId: selectedId })
  }, [search, segment, city, selectedId])

  function handleCompanySaved(saved: Company) {
    setCompany(saved)
    setSelection({ mode: "company", id: saved.id })
    reloadList()
  }

  const isSheetOpen = selection.mode !== "none"
  const hasFilters = Boolean(search || segment || city)

  return (
    <Page width="wide" className="gap-6">
      <PageHeader
        eyebrow="Comercial"
        title="Empresas"
        description={
          isListLoading && companies.length === 0
            ? "Carregando a base de empresas-alvo…"
            : `${pluralize(totalCount, "empresa", "empresas")}${hasFilters ? " encontradas" : " na base"}. Contatos, negócios e dados de cada uma numa ficha só.`
        }
        actions={
          <Button type="button" onClick={() => setSelection({ mode: "new" })}>
            <Plus aria-hidden="true" />
            Nova empresa
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start xl:grid-cols-[24rem_minmax(0,1fr)]">
        <Card
          role="region"
          aria-label="Lista de empresas"
          className={cn(
            "min-h-0 lg:sticky lg:top-6 lg:flex lg:max-h-[calc(100svh-3rem)]",
            isSheetOpen ? "hidden" : "flex"
          )}
        >
          <CompanyList
            companies={companies}
            totalCount={totalCount}
            selectedId={selectedId}
            search={search}
            segment={segment}
            city={city}
            filterOptions={filterOptions}
            isLoading={isListLoading}
            error={listError}
            onSearchChange={setSearch}
            onSegmentChange={setSegment}
            onCityChange={setCity}
            onSelect={(id) => setSelection({ mode: "company", id })}
            onCreate={() => setSelection({ mode: "new" })}
            onRetry={reloadList}
          />
        </Card>

        <Card role="region" aria-label="Ficha da empresa" className={cn("min-w-0", isSheetOpen ? "flex" : "hidden lg:flex")}>
          {selection.mode === "none" && (
            <EmptyState
              icon={Building2}
              title="Nenhuma empresa aberta"
              description="Escolha uma empresa na lista para ver contatos, negócios e dados — ou cadastre uma nova empresa-alvo."
              action={
                <Button type="button" variant="outline" onClick={() => setSelection({ mode: "new" })}>
                  <Plus aria-hidden="true" />
                  Nova empresa
                </Button>
              }
              className="min-h-112"
            />
          )}

          {sheetError && (
            <div className="p-6">
              <Alert>{sheetError}</Alert>
            </div>
          )}

          {selection.mode === "new" && (
            <CompanySheet
              company={null}
              onCompanySaved={handleCompanySaved}
              onContactsChanged={setCompany}
              onBack={() => setSelection({ mode: "none" })}
              onOpenDeal={onOpenDeal}
              onNewDealForCompany={onNewDealForCompany}
            />
          )}

          {selection.mode === "company" && company && (
            <CompanySheet
              company={company}
              onCompanySaved={handleCompanySaved}
              onContactsChanged={(updated) => {
                setCompany(updated)
                reloadList()
              }}
              onBack={() => setSelection({ mode: "none" })}
              onOpenDeal={onOpenDeal}
              onNewDealForCompany={onNewDealForCompany}
            />
          )}

          {selection.mode === "company" && !company && !sheetError && (
            <div role="status" className="flex flex-col gap-4 p-6">
              <span className="sr-only">Carregando ficha…</span>
              <div className="flex items-center gap-4">
                <Skeleton className="size-12" />
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
              <Skeleton className="mt-4 h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}
        </Card>
      </div>
    </Page>
  )
}
