/** Só os dígitos servem para tel: e wa.me — o resto é máscara de exibição. */
function digitsOf(value: string) {
  return value.replace(/\D/g, "")
}

export function telHref(phone: string | null): string | null {
  if (!phone) return null
  const digits = digitsOf(phone)
  return digits.length >= 8 ? `tel:+${digits.length <= 11 ? `55${digits}` : digits}` : null
}

export function whatsAppHref(whatsApp: string | null): string | null {
  if (!whatsApp) return null
  const digits = digitsOf(whatsApp)
  return digits.length >= 8 ? `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}` : null
}

export function instagramHref(instagram: string | null): string | null {
  if (!instagram) return null
  const handle = instagram.trim()
  if (/^https?:\/\//i.test(handle)) return handle
  return `https://instagram.com/${handle.replace(/^@/, "")}`
}
