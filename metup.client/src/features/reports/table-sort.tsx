import { useMemo, useState, type ReactNode } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

import { TableHead } from "@/components/ui/table"
import { cn } from "@/lib/utils"

export type SortDirection = "asc" | "desc"

export type SortState<K extends string> = { key: K; direction: SortDirection }

/** Como extrair o valor comparável de cada coluna ordenável. Texto compara por locale; resto, numérico. */
export type SortAccessors<T, K extends string> = Record<K, (row: T) => number | string | null>

/**
 * Ordenação de tabela de relatório. Clicar numa coluna ordena por ela (a primeira vez na direção
 * que faz sentido: decrescente para número, crescente para texto); clicar de novo inverte.
 *
 * Valor ausente (`null`) sempre vai para o fim, nas duas direções — "sem dado" não é o menor
 * número, é a falta dele, e o usuário está ordenando para ver quem lidera, não quem não tem.
 */
export function useTableSort<T, K extends string>(rows: T[], accessors: SortAccessors<T, K>, initial: SortState<K>) {
  const [sort, setSort] = useState<SortState<K>>(initial)

  const sorted = useMemo(() => {
    const accessor = accessors[sort.key]
    const factor = sort.direction === "asc" ? 1 : -1

    return [...rows].sort((a, b) => {
      const left = accessor(a)
      const right = accessor(b)

      if (left === null && right === null) return 0
      if (left === null) return 1
      if (right === null) return -1

      const comparison =
        typeof left === "string" && typeof right === "string"
          ? left.localeCompare(right, "pt-BR")
          : Number(left) - Number(right)

      return comparison * factor
    })
    // `accessors` é recriado a cada render pelo chamador; a chave e a direção é que mudam o resultado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort])

  function toggle(key: K, defaultDirection: SortDirection) {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: defaultDirection }
    )
  }

  return { sort, sorted, toggle }
}

/**
 * Cabeçalho clicável de coluna ordenável, com `aria-sort` — é assim que o leitor de tela sabe por
 * onde a tabela está ordenada.
 */
export function SortableHead<K extends string>({
  columnKey,
  sort,
  onSort,
  numeric,
  defaultDirection = numeric ? "desc" : "asc",
  className,
  children,
}: {
  columnKey: K
  sort: SortState<K>
  onSort: (key: K, defaultDirection: SortDirection) => void
  numeric?: boolean
  defaultDirection?: SortDirection
  className?: string
  children: ReactNode
}) {
  const isActive = sort.key === columnKey
  const Arrow = sort.direction === "asc" ? ChevronUp : ChevronDown

  return (
    <TableHead
      numeric={numeric}
      // O respiro das bordas da tabela vive no botão, que é quem ocupa a célula inteira.
      className={cn("p-0 first:[&>button]:pl-5 last:[&>button]:pr-5", className)}
      aria-sort={isActive ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(columnKey, defaultDirection)}
        className={cn(
          "flex h-10 w-full cursor-pointer items-center gap-1 px-4 transition-colors hover:text-fg focus-visible:focus-ring",
          numeric && "justify-end",
          isActive && "text-fg"
        )}
      >
        {children}
        <Arrow aria-hidden="true" className={cn("size-3.5 shrink-0 transition-opacity", isActive ? "opacity-100" : "opacity-0")} />
      </button>
    </TableHead>
  )
}
