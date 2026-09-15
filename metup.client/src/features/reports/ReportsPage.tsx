import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Page, PageHeader } from "@/components/ui/page"
import { cn } from "@/lib/utils"
import { CohortsSection } from "./CohortsSection"
import { ForecastReportSection } from "./ForecastReportSection"
import { FunnelReportSection } from "./FunnelReportSection"
import { RankingSection } from "./RankingSection"
import { SalesByOwnerSection } from "./SalesByOwnerSection"
import { SalesBySegmentSection } from "./SalesBySegmentSection"
import { SalesBySourceSection } from "./SalesBySourceSection"
import { TimeToCloseReportSection } from "./TimeToCloseReportSection"

type ReportTab =
  | "funil"
  | "responsaveis"
  | "segmentos"
  | "origens"
  | "tempo-fechamento"
  | "safras"
  | "forecast"
  | "ranking"

const TABS: { id: ReportTab; label: string }[] = [
  { id: "funil", label: "Funil" },
  { id: "forecast", label: "Forecast" },
  { id: "ranking", label: "Ranking" },
  { id: "responsaveis", label: "Responsáveis" },
  { id: "segmentos", label: "Segmentos" },
  { id: "origens", label: "Origens" },
  { id: "tempo-fechamento", label: "Tempo até fechar" },
  { id: "safras", label: "Safras" },
]

const TAB_IDS: ReportTab[] = TABS.map((t) => t.id)

type Props = {
  initialFrom: string
  initialTo: string
  initialTab: string
  onStateChange: (state: { from: string; to: string; tab: ReportTab }) => void
}

/** Tela de Relatórios (V3, seção 7 do CLAUDE.md) — abas por relatório, período compartilhado. */
export function ReportsPage({ initialFrom, initialTo, initialTab, onStateChange }: Props) {
  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(initialTo)
  const [tab, setTab] = useState<ReportTab>(
    TAB_IDS.includes(initialTab as ReportTab) ? (initialTab as ReportTab) : "funil",
  )
  const tabListRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    onStateChange({ from, to, tab })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, tab])

  const fromIso = from ? new Date(`${from}T00:00:00`).toISOString() : undefined
  const toIso = to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined
  const hasPeriod = Boolean(from || to)

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
    <Page className="gap-6">
      <PageHeader
        eyebrow="Análise"
        title="Relatórios"
        description="Quanto trabalho comercial virou venda, onde o funil trava e como cada responsável está performando."
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="report-filter-from">De</Label>
              <Input
                id="report-filter-from"
                type="date"
                className="h-9 w-40"
                value={from}
                max={to || undefined}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="report-filter-to">Até</Label>
              <Input
                id="report-filter-to"
                type="date"
                className="h-9 w-40"
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            {hasPeriod && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Limpar período"
                title="Limpar período"
                onClick={() => {
                  setFrom("")
                  setTo("")
                }}
              >
                <X aria-hidden="true" />
              </Button>
            )}
          </div>
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
            {TABS.map((t) => {
              const isActive = tab === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  id={`report-tab-${t.id}`}
                  aria-selected={isActive}
                  aria-controls={`report-panel-${t.id}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "label-mono relative -mb-px flex h-11 cursor-pointer items-center border-b-2 transition-colors focus-visible:focus-ring",
                    isActive ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg-muted"
                  )}
                >
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>
        <p className="text-xs text-faint">
          {hasPeriod ? "Negócios criados no período selecionado." : "Todo o histórico da organização."}
        </p>
      </div>

      {TABS.map((t) => (
        <div key={t.id} id={`report-panel-${t.id}`} role="tabpanel" aria-labelledby={`report-tab-${t.id}`} hidden={tab !== t.id}>
          {tab === t.id && <ReportPanel tab={t.id} fromIso={fromIso} toIso={toIso} />}
        </div>
      ))}
    </Page>
  )
}

function ReportPanel({ tab, fromIso, toIso }: { tab: ReportTab; fromIso?: string; toIso?: string }) {
  switch (tab) {
    case "funil":
      return <FunnelReportSection fromIso={fromIso} toIso={toIso} />
    case "responsaveis":
      return <SalesByOwnerSection fromIso={fromIso} toIso={toIso} />
    case "segmentos":
      return <SalesBySegmentSection fromIso={fromIso} toIso={toIso} />
    case "origens":
      return <SalesBySourceSection fromIso={fromIso} toIso={toIso} />
    case "tempo-fechamento":
      return <TimeToCloseReportSection fromIso={fromIso} toIso={toIso} />
    case "safras":
      return <CohortsSection fromIso={fromIso} toIso={toIso} />
    case "forecast":
      return <ForecastReportSection fromIso={fromIso} toIso={toIso} />
    case "ranking":
      return <RankingSection fromIso={fromIso} toIso={toIso} />
  }
}
