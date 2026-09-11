import { ApiError } from "@/lib/api"

export type FieldErrors = Record<string, string>

/**
 * O servidor devolve as chaves no nome da propriedade do command ("Name", "WhatsApp").
 * Aqui elas viram os ids dos campos do formulário.
 */
export function toFieldErrors(error: unknown): FieldErrors {
  if (!(error instanceof ApiError) || !error.errors) return {}

  return Object.entries(error.errors).reduce<FieldErrors>((acc, [key, messages]) => {
    const field = key.charAt(0).toLowerCase() + key.slice(1)
    acc[field] = messages[0]
    return acc
  }, {})
}

export function toMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}
