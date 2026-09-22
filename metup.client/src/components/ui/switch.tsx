import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

/** Alternância binária (item 21) — o único lugar do app que precisa de um toggle liga/desliga. */
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-5.5 w-9.5 shrink-0 cursor-pointer items-center rounded-full border border-transparent shadow-inner transition-colors focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:bg-accent data-[state=unchecked]:bg-surface-3",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-surface shadow-raised ring-0 transition-transform",
          "translate-x-0.5 data-[state=checked]:translate-x-[1.125rem]"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
