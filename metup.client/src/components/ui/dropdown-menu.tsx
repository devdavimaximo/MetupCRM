import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

const DropdownMenu = DropdownMenuPrimitive.Root
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger

function DropdownMenuContent({
  className,
  align = "end",
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        align={align}
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn(
          "z-50 min-w-44 rounded-md border border-line-soft bg-surface-2 p-1 text-sm text-fg shadow-panel",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

/** Item de menu: realce neutro no foco (teclado ou ponteiro), ícone em âmbar só como marca. */
function DropdownMenuItem({ className, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Item>) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-sm px-2.5 py-2 text-fg-muted outline-none select-none",
        "data-highlighted:bg-surface-3 data-highlighted:text-fg data-disabled:pointer-events-none data-disabled:text-faint",
        "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted data-highlighted:[&_svg]:text-accent",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return <DropdownMenuPrimitive.Separator className={cn("-mx-1 my-1 h-px bg-line-soft", className)} {...props} />
}

/** Título de um grupo do menu (não é item: o leitor de tela o lê, as setas o pulam). */
function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return <DropdownMenuPrimitive.Label className={cn("label-mono px-2 pt-1.5 pb-1 text-muted", className)} {...props} />
}

const DropdownMenuSub = DropdownMenuPrimitive.Sub

/** Item que abre um submenu (seta à direita; → abre, ← volta). */
function DropdownMenuSubTrigger({ className, children, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger>) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-sm px-2.5 py-2 text-fg-muted outline-none select-none",
        "data-highlighted:bg-surface-3 data-highlighted:text-fg data-[state=open]:bg-surface-3 data-[state=open]:text-fg",
        "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted data-highlighted:[&_svg]:text-accent",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRight className="ml-auto" aria-hidden="true" />
    </DropdownMenuPrimitive.SubTrigger>
  )
}

function DropdownMenuSubContent({ className, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.SubContent
        data-slot="dropdown-menu-sub-content"
        sideOffset={4}
        collisionPadding={12}
        className={cn(
          "z-50 min-w-44 rounded-md border border-line-soft bg-surface-2 p-1 text-sm text-fg shadow-panel",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
}
