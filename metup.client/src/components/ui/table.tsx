import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Tabela de dados. Densidade de operação: linhas de 44px, cabeçalho mono em caixa alta,
 * filetes finos entre linhas, números alinhados à direita em algarismos tabulares.
 * Rola na horizontal dentro do próprio painel — nunca a página.
 */
function Table({ className, minWidth, ...props }: React.ComponentProps<"table"> & { minWidth?: string }) {
  return (
    <div className="overflow-x-auto">
      <table
        data-slot="table"
        style={minWidth ? { minWidth } : undefined}
        className={cn("w-full border-collapse text-base", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn("border-b border-line-soft", className)} {...props} />
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={cn("divide-y divide-line-soft/70", className)} {...props} />
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return <tr data-slot="table-row" className={cn("transition-colors hover:bg-surface-2/60", className)} {...props} />
}

function TableHead({ className, numeric, ...props }: React.ComponentProps<"th"> & { numeric?: boolean }) {
  return (
    <th
      data-slot="table-head"
      scope="col"
      className={cn(
        "label-mono h-10 px-4 text-left align-middle font-medium whitespace-nowrap text-muted first:pl-5 last:pr-5",
        numeric && "text-right",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, numeric, ...props }: React.ComponentProps<"td"> & { numeric?: boolean }) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "h-11 px-4 align-middle whitespace-nowrap text-fg-muted first:pl-5 last:pr-5",
        numeric && "tabular text-right",
        className
      )}
      {...props}
    />
  )
}

function TableRowHeader({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-row-header"
      scope="row"
      className={cn("h-11 px-4 text-left align-middle font-medium whitespace-nowrap text-fg first:pl-5", className)}
      {...props}
    />
  )
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableRowHeader }
