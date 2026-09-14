import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CohortsSection } from "./CohortsSection"
import { ForecastReportSection } from "./ForecastReportSection"
import { FunnelReportSection } from "./FunnelReportSection"
import { SalesByOwnerSection } from "./SalesByOwnerSection"
import { SalesBySegmentSection } from "./SalesBySegmentSection"
import { SalesBySourceSection } from "./SalesBySourceSection"
import { TimeToCloseReportSection } from "./TimeToCloseReportSection"

type ReportTab = "funil" | "responsaveis" | "segmentos" | "origens" | "tempo-fechamento" | "safras" | "forecast"

const TABS: { id: ReportTab; label: string }[] = [
  { id: "funil", label: "Funil" },
  { id: "responsaveis", label: "Por responsável" },
  { id: "segmentos", label: "Por segmento" },
  { id: "origens", label: "Por origem" },
  { id: "tempo-fechamento", label: "Tempo até fechamento" },
  { id: "safras", label: "Safras" },
  { id: "forecast", label: "Forecast" },
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

  useEffect(() => {
    onStateChange({ from, to, tab })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, tab])

  const fromIso = from ? new Date(`${from}T00:00:00`).toISOString() : undefined
  const toIso = to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined
  const hasExtraFilters = Boolean(from || to)

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Relatórios</h1>
        <p className="text-sm text-muted-foreground">
          Quanto trabalho comercial virou venda, onde o funil trava e como cada responsável está performando.
        </p>
      </header>

      <div
        role="tablist"
        aria-label="Relatório"
        className="flex w-fit gap-1 rounded-lg border border-border bg-muted p-1"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`report-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`report-panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`min-h-9 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="report-filter-from" className="text-xs text-muted-foreground">
            De
          </Label>
          <Input
            id="report-filter-from"
            type="date"
            className="w-36"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="report-filter-to" className="text-xs text-muted-foreground">
            Até
          </Label>
          <Input
            id="report-filter-to"
            type="date"
            className="w-36"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>

        {hasExtraFilters && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setFrom("")
              setTo("")
            }}
          >
            Limpar período
          </Button>
        )}

        <p className="ml-auto text-xs text-muted-foreground">
          {from || to ? "Negócios criados no período selecionado." : "Todo o histórico da organização."}
        </p>
      </div>

      <div id="report-panel-funil" role="tabpanel" aria-labelledby="report-tab-funil" hidden={tab !== "funil"}>
        {tab === "funil" && <FunnelReportSection fromIso={fromIso} toIso={toIso} />}
      </div>

      <div
        id="report-panel-responsaveis"
        role="tabpanel"
        aria-labelledby="report-tab-responsaveis"
        hidden={tab !== "responsaveis"}
      >
        {tab === "responsaveis" && <SalesByOwnerSection fromIso={fromIso} toIso={toIso} />}
      </div>

      <div
        id="report-panel-segmentos"
        role="tabpanel"
        aria-labelledby="report-tab-segmentos"
        hidden={tab !== "segmentos"}
      >
        {tab === "segmentos" && <SalesBySegmentSection fromIso={fromIso} toIso={toIso} />}
      </div>

      <div id="report-panel-origens" role="tabpanel" aria-labelledby="report-tab-origens" hidden={tab !== "origens"}>
        {tab === "origens" && <SalesBySourceSection fromIso={fromIso} toIso={toIso} />}
      </div>

      <div
        id="report-panel-tempo-fechamento"
        role="tabpanel"
        aria-labelledby="report-tab-tempo-fechamento"
        hidden={tab !== "tempo-fechamento"}
      >
        {tab === "tempo-fechamento" && <TimeToCloseReportSection fromIso={fromIso} toIso={toIso} />}
      </div>

      <div id="report-panel-safras" role="tabpanel" aria-labelledby="report-tab-safras" hidden={tab !== "safras"}>
        {tab === "safras" && <CohortsSection fromIso={fromIso} toIso={toIso} />}
      </div>

      <div id="report-panel-forecast" role="tabpanel" aria-labelledby="report-tab-forecast" hidden={tab !== "forecast"}>
        {tab === "forecast" && <ForecastReportSection fromIso={fromIso} toIso={toIso} />}
      </div>
    </div>
  )
}
