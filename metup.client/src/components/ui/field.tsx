import * as React from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { cn } from "@/lib/utils"

type FieldShellProps = {
  id: string
  label: string
  required?: boolean
  error?: string
  hint?: React.ReactNode
  className?: string
  children: React.ReactNode
}

export function fieldDescribedBy(id: string, error?: string, hint?: React.ReactNode) {
  return [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined
}

/**
 * Casca de campo: rótulo, controle, dica e erro. A dica vem depois do controle (mesma
 * decisão da LP) para campos lado a lado dividirem a linha de base. Cor nunca é o único
 * sinal de erro: o filete muda E a frase aparece.
 */
export function FieldShell({ id, label, required, error, hint, className, children }: FieldShellProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <Label htmlFor={id}>
        {label}
        {required && (
          <span className="text-muted" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

type FieldProps = Omit<React.ComponentProps<"input">, "id"> & {
  id: string
  label: string
  /** Erro vindo da validação do servidor, exibido junto do campo. */
  error?: string
  hint?: React.ReactNode
}

/** O padrão único de input do sistema. */
export function Field({ id, label, error, hint, className, required, ...props }: FieldProps) {
  return (
    <FieldShell id={id} label={label} required={required} error={error} hint={hint} className={className}>
      <Input
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={fieldDescribedBy(id, error, hint)}
        {...props}
      />
    </FieldShell>
  )
}

type SelectFieldProps = Omit<React.ComponentProps<"select">, "id"> & {
  id: string
  label: string
  error?: string
  hint?: React.ReactNode
}

/** Mesma casca do Field, para seleção entre opções fixas (estágio, origem, responsável…). */
export function SelectField({ id, label, error, hint, className, required, children, ...props }: SelectFieldProps) {
  return (
    <FieldShell id={id} label={label} required={required} error={error} hint={hint} className={className}>
      <Select
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={fieldDescribedBy(id, error, hint)}
        {...props}
      >
        {children}
      </Select>
    </FieldShell>
  )
}
