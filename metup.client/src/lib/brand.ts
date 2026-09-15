/**
 * Identidade exibida pela interface — num lugar só (CLAUDE.md 4.1: nada de "Metup"
 * espalhado pelo código). Quando o sistema virar produto de cliente, a marca do tenant
 * entra aqui em vez de uma busca-e-substitui pelas telas.
 */
export const brand = {
  /** Wordmark em duas tintas: `lead` em creme, `accent` em dourado. */
  wordmark: { lead: "met", accent: "up" },
  name: "Metup",
  product: "CRM",
  tagline: "Sistema operacional comercial",
  markSrc: "/brand/logometup-64.webp",
  markSrcSet: "/brand/logometup-64.webp 64w, /brand/logometup-128.webp 128w",
} as const
