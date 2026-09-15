import { brand } from "@/lib/brand"
import { cn } from "@/lib/utils"

/**
 * Brasão da aplicação: símbolo + wordmark em duas tintas (a assinatura oficial da LP,
 * "met" em creme e "up" em dourado) + o nome do produto em rótulo mono.
 * O símbolo é decorativo (`alt=""`): o nome está escrito ao lado.
 */
export function BrandLockup({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5 select-none", className)}>
      <img
        src={brand.markSrc}
        srcSet={brand.markSrcSet}
        sizes="28px"
        width={28}
        height={28}
        alt=""
        className="size-7 shrink-0"
        decoding="async"
      />
      {compact ? (
        <span className="sr-only">
          {brand.name} {brand.product}
        </span>
      ) : (
        <span className="flex items-baseline gap-2">
          <span className="text-[1.0625rem] leading-none font-semibold tracking-[-0.03em] text-fg">
            {brand.wordmark.lead}
            <span className="text-accent">{brand.wordmark.accent}</span>
          </span>
          <span className="label-mono rounded-xs border border-line-soft px-1 text-[0.625rem] leading-4 text-muted">
            {brand.product}
          </span>
        </span>
      )}
    </span>
  )
}
