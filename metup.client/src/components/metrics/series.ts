/**
 * Suaviza a forma de uma série para desenho (média móvel ponderada, janela proporcional ao
 * tamanho). Só a curva usa isto — valores de tooltip e KPIs continuam sendo os reais.
 * Mantém primeiro e último ponto para a linha começar e terminar no valor verdadeiro.
 */
export function smoothSeries(values: number[], strength = 0.12): number[] {
  const radius = Math.max(1, Math.round(values.length * strength))
  if (values.length < 4) return values
  return values.map((_, i) => {
    if (i === 0 || i === values.length - 1) return values[i]
    const reach = Math.min(radius, i, values.length - 1 - i)
    let weighted = 0
    let weights = 0
    for (let offset = -reach; offset <= reach; offset++) {
      const weight = reach + 1 - Math.abs(offset)
      weighted += values[i + offset] * weight
      weights += weight
    }
    return weighted / weights
  })
}
