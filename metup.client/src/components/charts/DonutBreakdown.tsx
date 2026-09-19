import { createContext, useContext, useState, type ReactNode } from "react"
import { Cell, Pie, PieChart, ResponsiveContainer, Sector, Tooltip } from "recharts"
import type { PieSectorShapeProps } from "recharts/types/polar/Pie"

import { Hint } from "@/components/ui/tooltip"
import { numberFormatter } from "@/lib/format"
import { cn } from "@/lib/utils"

export type DonutSlice = { key: string; label: string; value: number; color: string }

const EMPTY_DONUT = [{ key: "empty", label: "", value: 1 }]

/**
 * A fatia destacada chega por contexto, não por closure: um `shape` novo a cada render trocaria o
 * tipo do componente, remontaria os paths sob o ponteiro e o Recharts fecharia o tooltip.
 */
const ActiveSliceContext = createContext<string | null>(null)

function ActiveSector(props: PieSectorShapeProps) {
  const activeKey = useContext(ActiveSliceContext)
  const isActive = activeKey !== null && (props.payload as DonutSlice | undefined)?.key === activeKey
  return <Sector {...props} outerRadius={(props.outerRadius ?? 0) + (isActive ? 4 : 0)} />
}

const renderSector = (props: PieSectorShapeProps) => <ActiveSector {...props} />

type Props<T extends DonutSlice> = {
  /** Estáveis entre renders (memo): um array novo a cada hover faria o Recharts zerar o tooltip ativo. */
  slices: T[]
  total: number
  /** Legenda do número no centro ("no período", "total"). */
  centerCaption: string
  /** Nome acessível da lista da legenda. */
  legendLabel: string
  /** Texto da legenda quando não há fatia. */
  emptyText: string
  /** Conteúdo do tooltip da fatia e da linha da legenda — o mesmo nos dois. */
  details: (slice: T) => ReactNode
  /** Coluna da direita da legenda. */
  legendValue: (slice: T) => ReactNode
  /** Nome acessível da linha da legenda. */
  legendAriaLabel: (slice: T) => string
  /** Com ele, fatia e linha da legenda viram ação (ex.: trocar de aba). */
  onSelect?: (slice: T) => void
  /** Tamanho do anel (classes de largura/altura). */
  sizeClassName?: string
  /** `column`: anel em cima e legenda embaixo, para colunas estreitas (lateral de ~320px). */
  layout?: "row" | "column"
}

/**
 * Donut + legenda com um único estado de destaque: o ponteiro na fatia realça a linha da legenda,
 * e o ponteiro (ou o foco do teclado) na legenda realça a fatia e mostra os mesmos detalhes.
 * A fatia ativa cresce 4px para fora; o anel reserva essa folga para não cortar. Sem fatias, um
 * anel cinza.
 */
export function DonutBreakdown<T extends DonutSlice>({
  slices,
  total,
  centerCaption,
  legendLabel,
  emptyText,
  details,
  legendValue,
  legendAriaLabel,
  onSelect,
  sizeClassName = "size-24 min-[1440px]:size-28 min-[1700px]:size-34",
  layout = "row",
}: Props<T>) {
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const isEmpty = slices.length === 0
  // Com mais de 4 linhas a legenda aperta o espaçamento para caber na altura do painel em 1366–1600px.
  const dense = slices.length > 4

  return (
    <div className={cn("flex min-h-0 flex-1 items-center", layout === "column" ? "flex-col gap-3" : "gap-4 min-[1440px]:gap-5")}>
      <div className={cn("relative my-2 shrink-0", sizeClassName)}>
        <ActiveSliceContext.Provider value={activeKey}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <Pie
                data={isEmpty ? EMPTY_DONUT : slices}
                dataKey="value"
                nameKey="label"
                innerRadius="68%"
                outerRadius="92%"
                paddingAngle={slices.length > 1 ? 2 : 0}
                startAngle={90}
                endAngle={-270}
                stroke="var(--color-surface)"
                strokeWidth={2}
                isAnimationActive={!isEmpty}
                shape={renderSector}
                className={cn(onSelect && !isEmpty && "cursor-pointer")}
                onMouseEnter={(_, index) => {
                  if (!isEmpty) setActiveKey(slices[index]?.key ?? null)
                }}
                onMouseLeave={() => setActiveKey(null)}
                onClick={(_, index) => {
                  const slice = slices[index]
                  if (!isEmpty && slice && onSelect) onSelect(slice)
                }}
              >
                {(isEmpty ? [{ key: "empty", color: "var(--color-surface-3)" }] : slices).map((slice) => (
                  <Cell key={slice.key} fill={slice.color} />
                ))}
              </Pie>
              {!isEmpty && (
                <Tooltip
                  content={(props) => {
                    const slice = (props.payload as ReadonlyArray<{ payload?: T }> | undefined)?.[0]?.payload
                    if (!props.active || !slice) return null
                    return (
                      <div className="rounded-md border border-line-strong/60 bg-surface-2/95 px-3 py-2 shadow-raised backdrop-blur-sm">
                        {details(slice)}
                      </div>
                    )
                  }}
                  wrapperStyle={{ zIndex: 20 }}
                  allowEscapeViewBox={{ x: true, y: true }}
                  isAnimationActive={false}
                />
              )}
            </PieChart>
          </ResponsiveContainer>
        </ActiveSliceContext.Provider>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xl font-semibold text-fg tabular">{numberFormatter.format(total)}</span>
          <span className="text-2xs text-fg-muted">{centerCaption}</span>
        </div>
      </div>

      <ul aria-label={legendLabel} className={cn("flex min-w-0 flex-1 flex-col", layout === "column" && "w-full", dense ? "gap-0" : "gap-1")}>
        {isEmpty && <li className="text-sm text-muted">{emptyText}</li>}
        {slices.map((slice) => {
          const active = activeKey === slice.key
          return (
            <li key={slice.key}>
              <Hint content={details(slice)} side="left" className="max-w-none">
                <button
                  type="button"
                  aria-label={legendAriaLabel(slice)}
                  onClick={onSelect ? () => onSelect(slice) : undefined}
                  onMouseEnter={() => setActiveKey(slice.key)}
                  onMouseLeave={() => setActiveKey(null)}
                  onFocus={() => setActiveKey(slice.key)}
                  onBlur={() => setActiveKey(null)}
                  onKeyDown={(event) => {
                    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return
                    event.preventDefault()
                    const item = event.currentTarget.closest("li")
                    const sibling = event.key === "ArrowDown" ? item?.nextElementSibling : item?.previousElementSibling
                    sibling?.querySelector("button")?.focus()
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-sm px-1.5 text-left text-sm transition-colors focus-visible:focus-ring",
                    onSelect ? "cursor-pointer" : "cursor-default",
                    dense ? "py-px leading-4" : "py-1",
                    active && "bg-surface-3/60"
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: slice.color }} />
                    <span className={cn("leading-tight transition-colors", active ? "text-fg" : "text-fg-muted")}>{slice.label}</span>
                  </span>
                  <span className="shrink-0 text-fg tabular">{legendValue(slice)}</span>
                </button>
              </Hint>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
