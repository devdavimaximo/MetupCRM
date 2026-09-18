import { useEffect, useState } from "react"

import type { ActivityType } from "@/features/activities/api"
import type { DealStage } from "@/features/deals/api"
import { useAsyncResource, useDebouncedValue } from "@/lib/hooks"
import { todayLocal, type LocalDate } from "@/lib/local-date"
import { readUrlState, writeUrlState } from "@/lib/url-state"
import { getTaskSummary, listTasks, type TaskScope, type TaskSort, type TaskStatus } from "./api"
import { parseTasksUrl, serializeTasksUrl, type OwnerFilter, type PageSize } from "./task-format"

export type TaskFilters = {
  /** Só vale na aba Todas: as outras abas são sempre pendentes (regra do servidor). */
  statuses: TaskStatus[]
  types: ActivityType[]
  stages: DealStage[]
  search: string
}

const NO_FILTERS: TaskFilters = { statuses: [], types: [], stages: [], search: "" }

/** Quantos filtros estão valendo na aba — o status fora de Todas não conta, porque não é enviado. */
export function activeFilterCount(filters: TaskFilters, tab: TaskScope) {
  return (
    (tab === "All" ? filters.statuses.length : 0) +
    filters.types.length +
    filters.stages.length +
    (filters.search.trim() ? 1 : 0)
  )
}

function ownerParams(owner: OwnerFilter) {
  if (owner.kind === "all") return { allOwners: true }
  if (owner.kind === "user") return { ownerUserId: owner.userId }
  return {}
}

/**
 * O estado inteiro da tela de Tarefas (aba, filtros, ordenação, página, data, responsável) e as duas
 * fontes que dependem dele: a página da lista e o resumo das abas/KPIs. Toda mudança que troca o
 * recorte volta para a página 1 no mesmo evento — nada é corrigido depois, em efeito.
 *
 * `canSeeOthers` falso (SDR) nunca manda `allOwners`/`ownerUserId`: o servidor responderia 403.
 */
export function useTasksView(canSeeOthers: boolean) {
  const [initial] = useState(() => {
    const url = readUrlState()
    return parseTasksUrl(
      {
        tab: url.tasksTab,
        page: url.tasksPage,
        pageSize: url.tasksPageSize,
        date: url.tasksDate,
        owner: url.ownerUserId,
        legacyStatus: url.taskStatus,
        legacyDueFrom: url.dueFrom,
        legacyDueTo: url.dueTo,
      },
      canSeeOthers
    )
  })

  const [tab, setTabState] = useState<TaskScope>(initial.tab)
  const [filters, setFiltersState] = useState<TaskFilters>({ ...NO_FILTERS, statuses: initial.statuses })
  const [sort, setSortState] = useState<TaskSort>("DueAsc")
  const [page, setPage] = useState(initial.page)
  const [pageSize, setPageSizeState] = useState<PageSize>(initial.pageSize)
  const [referenceDate, setReferenceDateState] = useState<LocalDate>(initial.referenceDate ?? todayLocal())
  const [owner, setOwnerState] = useState<OwnerFilter>(initial.owner)

  const search = useDebouncedValue(filters.search.trim(), 300)
  const owners = ownerParams(canSeeOthers ? owner : { kind: "mine" })
  const ownerKey = JSON.stringify(owners)
  const statuses = tab === "All" ? filters.statuses : []

  const list = useAsyncResource(
    (signal) =>
      listTasks(
        {
          ...owners,
          scope: tab,
          referenceDate,
          statuses,
          types: filters.types,
          dealStages: filters.stages,
          search: search || undefined,
          sort,
          page,
          pageSize,
        },
        signal
      ),
    [tab, referenceDate, statuses.join(), filters.types.join(), filters.stages.join(), search, sort, page, pageSize, ownerKey],
    {
      keepPreviousData: true,
      // Página que esvaziou (a última linha foi concluída, o total encolheu): volta uma.
      onSuccess: (result) => {
        if (result.items.length === 0 && result.page > 1) setPage(Math.max(1, Math.min(result.page - 1, result.totalPages)))
      },
    }
  )

  const summary = useAsyncResource((signal) => getTaskSummary({ ...owners, referenceDate }, signal), [referenceDate, ownerKey], {
    keepPreviousData: true,
  })

  // A URL é um sistema externo: o efeito só a sincroniza, não deriva estado.
  useEffect(() => {
    writeUrlState(serializeTasksUrl({ tab, page, pageSize, referenceDate, owner }, todayLocal()))
  }, [tab, page, pageSize, referenceDate, owner])

  return {
    tab,
    filters,
    sort,
    page,
    pageSize,
    referenceDate,
    owner,
    list,
    summary,
    activeFilters: activeFilterCount(filters, tab),
    setTab(next: TaskScope) {
      setTabState(next)
      setPage(1)
    },
    setFilters(next: TaskFilters) {
      setFiltersState(next)
      setPage(1)
    },
    clearFilters() {
      setFiltersState(NO_FILTERS)
      setPage(1)
    },
    setSort(next: TaskSort) {
      setSortState(next)
      setPage(1)
    },
    setPage,
    setPageSize(next: PageSize) {
      setPageSizeState(next)
      setPage(1)
    },
    setReferenceDate(next: LocalDate) {
      setReferenceDateState(next)
      setPage(1)
    },
    setOwner(next: OwnerFilter) {
      setOwnerState(next)
      setPage(1)
    },
    /** Depois de uma ação: resumo e página atual em segundo plano, sem esqueleto nem salto. */
    revalidate() {
      list.reload({ silent: true })
      summary.reload({ silent: true })
    },
  }
}

export type TasksView = ReturnType<typeof useTasksView>
