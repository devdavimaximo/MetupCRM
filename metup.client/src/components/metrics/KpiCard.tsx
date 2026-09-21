import { useRef, useState, type ReactNode } from "react"
import { ArrowDown, ArrowUp, Minus, X, type LucideIcon } from "lucide-react"

import { Hint } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { deltaTone, type Delta, type DeltaPolarity, type DeltaTone } from "./delta"
import { Panel, panelSurface } from "./panel"
import { carouselPageAt, carouselPageCount, carouselRangeLabel } from "./carousel"
import { Sparkline } from "./Sparkline"

/** Texto e tooltip de cada caso sem percentual — o cartão explica a ausência em vez de calá-la. */
const deltaFallback = {
  new: { text: "novo", hint: "Nada no período anterior — não há percentual a calcular." },
  idle: { text: "sem movimento", hint: "Nenhum registro neste período nem no anterior." },
  "no-history": {
    text: "primeiro período com dados",
    hint: "O período anterior é anterior ao primeiro negócio — ainda não há base de comparação.",
  },
  "no-base": { text: "Sem base anterior", hint: "Nada existia no escopo nessa data — não há o que comparar." },
} as const

const toneClasses: Record<DeltaTone, string> = {
  positive: "text-success",
  negative: "text-danger",
  neutral: "text-fg-muted",
}

export function DeltaLine({
  delta,
  comparison,
  polarity = "higher-is-better",
  caption,
}: {
  delta: Delta
  comparison: string
  /** Que cor a seta ganha. O padrão é o do dashboard: subir é bom. */
  polarity?: DeltaPolarity
  /** Legenda sob o número. Sem ela: "vs. período anterior" (encurta abaixo de 2xl). */
  caption?: string
}) {
  if (delta.kind !== "change") {
    const { text, hint } = deltaFallback[delta.kind]
    return (
      <Hint content={delta.kind === "no-history" || delta.kind === "no-base" ? hint : `${hint} Comparado com ${comparison}.`}>
        <p className="text-xs text-muted">{text}</p>
      </Hint>
    )
  }

  const Icon = delta.direction === "up" ? ArrowUp : delta.direction === "down" ? ArrowDown : Minus
  return (
    <Hint content={`vs. ${comparison}`}>
      <div className="flex flex-col whitespace-nowrap">
        <span
          className={cn(
            "inline-flex items-center gap-1 text-sm font-medium tabular",
            toneClasses[deltaTone(delta.direction, polarity)]
          )}
        >
          <Icon className="size-3.5" aria-hidden="true" />
          {delta.label}
        </span>
        <span className="text-xs text-muted">
          {caption ?? (
            <>
              vs. <span className="max-2xl:hidden">período </span>anterior
            </>
          )}
        </span>
      </div>
    </Hint>
  )
}

export function KpiCard({
  icon: Icon,
  label,
  hint,
  value,
  valueTitle,
  delta,
  comparison,
  trend = [],
  tone = "default",
  polarity,
  caption,
  pressed,
  onClick,
  onDismiss,
  dismissLabel,
}: {
  icon: LucideIcon
  label: string
  /** A fórmula do número, para o tooltip — todo percentual da tela tem nome e conta. */
  hint?: string
  value: string
  /** Valor por extenso no `title` quando o texto vem compacto ("R$ 2,86 mi"). */
  valueTitle?: string
  delta: Delta
  comparison: string
  trend?: number[]
  /** `danger`: ícone e número em vermelho (Atrasadas). */
  tone?: "default" | "danger"
  polarity?: DeltaPolarity
  caption?: string
  /** Com `onClick` o cartão inteiro vira um botão de alternância (`aria-pressed`). */
  pressed?: boolean
  onClick?: () => void
  /** Com `onDismiss` o cartão ganha o `×` que o oculta (preferência local do usuário). */
  onDismiss?: () => void
  dismissLabel?: string
}) {
  const body = (
    <>
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-line-soft bg-surface-3/80",
            tone === "danger" ? "text-danger" : "text-accent"
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
        {hint ? (
          <Hint content={`${label} — ${hint}`}>
            <p tabIndex={0} className="truncate rounded-xs text-sm text-fg focus-visible:focus-ring">
              {label}
            </p>
          </Hint>
        ) : (
          <p className="truncate text-sm text-fg">{label}</p>
        )}
      </div>
      <p
        title={valueTitle}
        className={cn(
          "text-2xl font-semibold tracking-[-0.01em] whitespace-nowrap tabular",
          tone === "danger" ? "text-danger" : "text-fg"
        )}
      >
        {value}
      </p>
      <div className="flex items-end justify-between gap-2">
        <DeltaLine delta={delta} comparison={comparison} polarity={polarity} caption={caption} />
        <div className="h-9 min-w-0 flex-1 max-w-28" aria-hidden="true">
          {trend.length > 1 && <Sparkline values={trend} />}
        </div>
      </div>
    </>
  )

  /** O `×` fica fora do botão do cartão: um botão dentro de outro seria inválido. */
  const dismiss = onDismiss && (
    <button
      type="button"
      onClick={onDismiss}
      aria-label={dismissLabel ?? `Ocultar ${label}`}
      className="absolute top-1.5 right-1.5 z-10 inline-flex size-6 max-md:top-0 max-md:right-0 max-md:size-11 cursor-pointer items-center justify-center rounded-sm text-faint transition-colors hover:bg-surface-3 hover:text-fg focus-visible:focus-ring"
    >
      <X className="size-3.5" aria-hidden="true" />
    </button>
  )

  if (onClick) {
    const trigger = (
      <button
        type="button"
        aria-pressed={pressed}
        onClick={onClick}
        className={cn(
          panelSurface,
          "min-h-fit w-full cursor-pointer gap-2 overflow-hidden px-4 py-3.5 text-left transition-colors hover:border-line-strong focus-visible:focus-ring",
          pressed && "border-accent/60 hover:border-accent/60"
        )}
      >
        {body}
      </button>
    )

    // Sem o `×`, o cartão continua sendo o próprio botão no grid — nada de embrulho a mais.
    return dismiss ? (
      <div className="relative min-w-0">
        {trigger}
        {dismiss}
      </div>
    ) : (
      trigger
    )
  }

  return (
    <Panel aria-label={label} className="min-h-fit gap-2 overflow-hidden px-4 py-3.5">
      {body}
      {dismiss}
    </Panel>
  )
}

/**
 * Os KPIs no celular: faixa que rola na horizontal com encaixe, duas de cada vez. A rolagem é do
 * próprio trilho, então a página não rola de lado. Pelo teclado, Tab já percorre os cartões (o
 * navegador traz o foco para a vista); as setas movem de página para quem estiver com o trilho em foco.
 * O indicador de posição é clicável (alvo de 44px) e a posição também é lida em texto.
 */
export function KpiCarousel({ children, label }: { children: ReactNode[]; label: string }) {
  const trackRef = useRef<HTMLUListElement>(null)
  const [page, setPage] = useState(0)
  const pages = carouselPageCount(children.length)

  function goTo(next: number) {
    const track = trackRef.current
    if (!track) return
    const target = Math.max(0, Math.min(pages - 1, next))
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    track.scrollTo({ left: target * track.clientWidth, behavior: reduced ? "auto" : "smooth" })
  }

  return (
    <div className="flex flex-col gap-1">
      <ul
        ref={trackRef}
        aria-label={label}
        tabIndex={0}
        onScroll={(event) => {
          const track = event.currentTarget
          setPage(carouselPageAt(track.scrollLeft, track.clientWidth, pages))
        }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return
          event.preventDefault()
          goTo(page + (event.key === "ArrowRight" ? 1 : -1))
        }}
        className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 scrollbar-none focus-visible:focus-ring motion-reduce:scroll-auto"
      >
        {children.map((child, index) => (
          <li key={index} className="w-[calc(50%-0.375rem)] shrink-0 snap-start">
            {child}
          </li>
        ))}
      </ul>
      {pages > 1 && (
        <div className="flex justify-center" role="group" aria-label={`Posição em ${label.toLowerCase()}`}>
          {Array.from({ length: pages }, (_, index) => (
            <button
              key={index}
              type="button"
              tabIndex={-1}
              aria-label={carouselRangeLabel(index, children.length)}
              aria-current={index === page || undefined}
              onClick={() => goTo(index)}
              className="group/dot inline-flex h-11 w-8 cursor-pointer items-center justify-center"
            >
              <span className={cn("h-1 w-5 rounded-full transition-colors", index === page ? "bg-accent" : "bg-line-strong")} />
            </button>
          ))}
          <span className="sr-only" aria-live="polite">
            {carouselRangeLabel(page, children.length)}
          </span>
        </div>
      )}
    </div>
  )
}
