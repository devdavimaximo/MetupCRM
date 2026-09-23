import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"

import { DateRangePicker } from "@/components/ui/date-range-picker"
import { Page, PageHeader } from "@/components/ui/page"
import { TooltipProvider } from "@/components/ui/tooltip"
import { addDays, todayLocal, type LocalDate } from "@/lib/local-date"
import { MAX_PERIOD_DAYS, isPresetId, periodLabel, resolvePeriod, type Period } from "@/lib/period"
import { cn } from "@/lib/utils"
import { CohortsTab } from "./CohortsTab"
import { ForecastTab } from "./ForecastTab"
import { FunnelTab } from "./FunnelTab"
import { OverviewTab, type ReportTab } from "./OverviewTab"
import { PerformanceTab } from "./PerformanceTab"
import { DEFAULT_REPORTS_PERIOD, reportPeriodPresets } from "./reports-period"

const TABS: { id: ReportTab; label: string }[] = [
  { id: "visao-geral", label: "Visão geral" },
  { id: "funil", label: "Funil" },
  { id: "desempenho", label: "Desempenho" },
  { id: "forecast", label: "Forecast" },
  { id: "safras", label: "Safras" },
]

const TAB_IDS: ReportTab[] = TABS.map((tab) => tab.id)

/** Abas antigas que viravam link compartilhado — cada uma cai onde o assunto dela mora hoje. */
const LEGACY_TABS: Record<string, ReportTab> = {
  responsaveis: "desempenho",
  segmentos: "desempenho",
  origens: "desempenho",
  "tempo-fechamento": "funil",
  ranking: "desempenho",
}

function readTab(value: string): ReportTab {
  if (TAB_IDS.includes(value as ReportTab)) return value as ReportTab
  return LEGACY_TABS[value] ?? "visao-geral"
}

type Props = {
  initialPeriod: Period
  initialTab: string
  onStateChange: (state: { period: Period; tab: ReportTab }) => void
}

/**
 * Relatórios (V3, seção 7 do CLAUDE.md). Um período compartilhado no topo e cinco leituras: o
 * resumo, o funil, o desempenho por eixo, o forecast e as safras. O período resolvido vai para o
 * servidor, que devolve a janela que valeu e a anterior — é dela que sai toda comparação da tela.
 */
export function ReportsPage({ initialPeriod, initialTab, onStateChange }: Props) {
  const [period, setPeriod] = useState<Period>(initialPeriod)
  const [tab, setTab] = useState<ReportTab>(() => readTab(initialTab))
  const tabListRef = useRef<HTMLDivElement>(null)

  // "Hoje" do navegador: só ancora os atalhos do calendário — quem recorta a janela é o servidor.
  const [today] = useState<LocalDate>(todayLocal)

  useEffect(() => {
    onStateChange({ period, tab })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, tab])

  const request = useMemo(() => resolvePeriod(period, today), [period, today])
  const periodName = periodLabel(period)
  const pickerRange = "days" in request ? { from: addDays(today, -(request.days - 1)), to: today } : request

  /** Setas movem entre abas (padrão WAI-ARIA de tablist com ativação automática). */
  function handleTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return
    event.preventDefault()
    const index = TAB_IDS.indexOf(tab)
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? TAB_IDS.length - 1
          : (index + (event.key === "ArrowLeft" ? -1 : 1) + TAB_IDS.length) % TAB_IDS.length
    setTab(TAB_IDS[next])
    tabListRef.current?.querySelectorAll<HTMLButtonElement>("[role=tab]")[next]?.focus()
  }

  return (
    <TooltipProvider>
      <Page width="wide" className="gap-5">
        <PageHeader
          eyebrow="Análise"
          title="Relatórios"
          description="Quanto trabalho comercial virou venda, onde o funil trava e como cada responsável está performando."
          actions={
            <DateRangePicker
              label={periodName}
              presets={reportPeriodPresets}
              activePresetId={period.kind === "preset" ? period.preset : null}
              range={pickerRange}
              maxDate={today}
              maxDays={MAX_PERIOD_DAYS}
              onPresetSelect={(id) => {
                if (isPresetId(id)) setPeriod({ kind: "preset", preset: id })
              }}
              onRangeSelect={({ from, to }) => setPeriod({ kind: "custom", from, to })}
              className="min-w-56 max-sm:flex-1"
            />
          }
        />

        <div className="flex flex-col gap-2">
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <div
              ref={tabListRef}
              role="tablist"
              aria-label="Relatório"
              onKeyDown={handleTabKeyDown}
              className="flex min-w-max gap-6 border-b border-line-soft"
            >
              {TABS.map((item) => {
                const isActive = tab === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    id={`report-tab-${item.id}`}
                    aria-selected={isActive}
                    aria-controls={`report-panel-${item.id}`}
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => setTab(item.id)}
                    className={cn(
                      "label-mono relative -mb-px flex h-11 cursor-pointer items-center border-b-2 transition-colors focus-visible:focus-ring",
                      isActive ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg-muted"
                    )}
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>
          <p className="text-xs text-faint">
            Período: {periodName}. Entrada no funil conta pela data de criação; receita e fechamentos, pela data de
            fechamento.
          </p>
        </div>

        {TABS.map((item) => (
          <div
            key={item.id}
            id={`report-panel-${item.id}`}
            role="tabpanel"
            aria-labelledby={`report-tab-${item.id}`}
            hidden={tab !== item.id}
          >
            {tab === item.id && (
              <ReportPanelContent tab={item.id} request={request} periodName={periodName} onOpenTab={setTab} />
            )}
          </div>
        ))}
      </Page>
    </TooltipProvider>
  )
}

function ReportPanelContent({
  tab,
  request,
  periodName,
  onOpenTab,
}: {
  tab: ReportTab
  request: ReturnType<typeof resolvePeriod>
  periodName: string
  onOpenTab: (tab: ReportTab) => void
}) {
  switch (tab) {
    case "visao-geral":
      return <OverviewTab request={request} periodName={periodName} onOpenTab={onOpenTab} />
    case "funil":
      return <FunnelTab request={request} periodName={periodName} />
    case "desempenho":
      return <PerformanceTab request={request} periodName={periodName} />
    case "forecast":
      return <ForecastTab request={request} />
    case "safras":
      return <CohortsTab request={request} periodName={periodName} />
  }
}

export { DEFAULT_REPORTS_PERIOD }
export type { ReportTab }
