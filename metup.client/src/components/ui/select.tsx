import * as React from "react"
import { ChevronDown } from "lucide-react"

import { controlClasses } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/** Select nativo com a casca do campo do sistema — acessível e rápido no mobile. */
function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative min-w-0">
      <select
        data-slot="select"
        className={cn(controlClasses, "h-10 cursor-pointer appearance-none truncate pr-9", className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
    </div>
  )
}

export { Select }
