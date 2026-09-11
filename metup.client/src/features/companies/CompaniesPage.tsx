import { useCallback, useEffect, useState } from "react"

import { useDebouncedValue } from "@/lib/hooks"
import { readUrlState, writeUrlState } from "@/lib/url-state"
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

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[22rem_1fr] lg:items-start">
      <section
        aria-label="Empresas"
        className={`flex flex-col lg:sticky lg:top-6 lg:max-h-[calc(100svh-6rem)] ${
          isSheetOpen ? "hidden lg:flex" : "flex"
        }`}
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
      </section>

      <section
        aria-label="Ficha da empresa"
        className={`rounded-xl border border-border bg-card p-4 sm:p-6 ${
          isSheetOpen ? "block" : "hidden lg:block"
        }`}
      >
        {selection.mode === "none" && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Selecione uma empresa na lista ou cadastre uma nova para abrir a ficha.
          </p>
        )}

        {sheetError && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {sheetError}
          </p>
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
          <p className="py-12 text-center text-sm text-muted-foreground">Carregando ficha…</p>
        )}
      </section>
    </div>
  )
}
