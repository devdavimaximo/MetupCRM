/**
 * Atalhos de tela de uma tecla só (`N`, `/`, `F`, `?`…). Regras comuns a qualquer tela:
 * - nada dispara com o foco num campo de texto (`input` de texto, `textarea`, `select`,
 *   `contenteditable`) — quem digita "n" num nome não quer abrir um negócio novo;
 * - nada dispara com Ctrl, Alt ou Meta (são do navegador e do sistema). Shift só vale para `?`,
 *   que no teclado ABNT e no americano precisa dele;
 * - tecla repetida (segurada) não dispara de novo.
 */

const TEXT_INPUT_TYPES = new Set(["text", "search", "email", "number", "password", "tel", "url", "date", "datetime-local", "month", "time", "week"])

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable || target.closest('[contenteditable]:not([contenteditable="false"])')) return true
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true
  return target instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(target.type)
}

type KeyLike = Pick<KeyboardEvent, "key" | "ctrlKey" | "altKey" | "metaKey" | "shiftKey" | "repeat" | "isComposing" | "defaultPrevented" | "target">

/** A tecla do atalho, em minúscula, ou `null` quando o evento não é um atalho de tela. */
export function shortcutKey(event: KeyLike): string | null {
  if (event.defaultPrevented || event.repeat || event.isComposing) return null
  if (event.ctrlKey || event.altKey || event.metaKey) return null
  if (isTypingTarget(event.target)) return null
  if (event.key === "?") return "?"
  if (event.shiftKey || event.key.length !== 1) return null
  return event.key.toLowerCase()
}

/** Um atalho como a folha de atalhos mostra: as teclas e o que fazem. */
export type ShortcutHelpItem = { keys: string[]; label: string }
