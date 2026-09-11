import * as React from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type FieldProps = Omit<React.ComponentProps<"input">, "id"> & {
  id: string
  label: string
  /** Erro vindo da validação do servidor, exibido junto do campo. */
  error?: string
  hint?: string
}

/**
 * Campo de formulário com label visível, erro ao lado do campo e ligação
 * via aria-describedby — o padrão único de input do sistema.
 */
export function Field({ id, label, error, hint, className, required, ...props }: FieldProps) {
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ")

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required && (
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      <Input
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...props}
      />
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
