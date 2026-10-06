import type { PhoneLineKind } from "./api"

/**
 * Por onde a chamada sai. O discador só fala com esta interface: hoje existe o canal do aparelho
 * (`tel:`); um softphone (WebRTC + provedor SIP) entra como outro canal sem mexer na fila, no
 * registro nem na tela.
 */
export type CallChannel = {
  kind: PhoneLineKind
  /** Começa a chamada para um número já discável (E.164 ou número de serviço). */
  dial: (dialString: string) => void
}

/**
 * Aparelho do usuário: o navegador entrega o `tel:` ao sistema. No celular abre o discador nativo;
 * no Windows, o app Vincular ao Celular liga pelo telefone pareado. Por isso o CRM não sabe se
 * atenderam nem quanto durou — o SDR marca o desfecho.
 */
export const deviceChannel: CallChannel = {
  kind: "Device",
  dial(dialString) {
    const link = document.createElement("a")
    link.href = `tel:${dialString}`
    link.rel = "noopener"
    link.click()
  },
}

export function channelFor(kind: PhoneLineKind): CallChannel {
  switch (kind) {
    case "Device":
      return deviceChannel
  }
}
