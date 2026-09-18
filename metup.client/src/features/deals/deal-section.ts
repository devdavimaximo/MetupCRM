/** Seção em que o drawer do negócio abre com foco e rolagem; sem ela, abre no topo. */
export type DealDrawerSection = "activity"

/** O nome da seção na URL (`?acao=atividade`), em pt-BR como o resto dos parâmetros. */
const URL_VALUES: Record<DealDrawerSection, string> = { activity: "atividade" }

export function dealSectionToUrl(section: DealDrawerSection | undefined) {
  return section ? URL_VALUES[section] : ""
}

export function dealSectionFromUrl(value: string): DealDrawerSection | undefined {
  return (Object.keys(URL_VALUES) as DealDrawerSection[]).find((section) => URL_VALUES[section] === value)
}
