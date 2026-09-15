import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

function Sheet(props: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetPortal(props: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-sunken/75 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

const sideClasses = {
  right:
    "inset-y-0 right-0 border-l data-[state=closed]:slide-out-to-right-8 data-[state=open]:slide-in-from-right-8",
  left: "inset-y-0 left-0 border-r data-[state=closed]:slide-out-to-left-8 data-[state=open]:slide-in-from-left-8",
} as const

const sizeClasses = {
  sm: "sm:max-w-xs",
  md: "sm:max-w-lg",
  lg: "sm:max-w-xl",
} as const

function SheetContent({
  className,
  children,
  side = "right",
  size = "lg",
  hideClose = false,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: keyof typeof sideClasses
  size?: keyof typeof sizeClasses
  hideClose?: boolean
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "fixed z-50 flex h-full w-full flex-col gap-0 border-line-soft bg-surface shadow-panel outline-none",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-150 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-250",
          sideClasses[side],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {children}
        {!hideClose && (
          <SheetPrimitive.Close className="absolute top-4 right-4 inline-flex size-8 cursor-pointer items-center justify-center rounded-xs text-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:focus-ring">
            <X className="size-4" aria-hidden="true" />
            <span className="sr-only">Fechar</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-2 border-b border-line-soft px-5 pt-5 pb-4 pr-14 sm:px-6", className)}
      {...props}
    />
  )
}

function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-body"
      className={cn("flex flex-1 flex-col overflow-y-auto overscroll-contain", className)}
      {...props}
    />
  )
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("font-display text-xl font-semibold tracking-[-0.015em] text-balance text-fg", className)}
      {...props}
    />
  )
}

function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return <SheetPrimitive.Description data-slot="sheet-description" className={cn("text-sm text-muted", className)} {...props} />
}

export { Sheet, SheetContent, SheetHeader, SheetBody, SheetTitle, SheetDescription }
