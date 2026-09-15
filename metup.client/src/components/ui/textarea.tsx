import * as React from "react"

import { controlClasses } from "@/components/ui/input"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(controlClasses, "flex resize-y py-2.5 leading-relaxed", className)}
      {...props}
    />
  )
}

export { Textarea }
