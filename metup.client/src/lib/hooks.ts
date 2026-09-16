import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type Dispatch, type SetStateAction } from "react"

/**
 * Acompanha uma media query do CSS. Serve para escolher a **árvore** que vai ao DOM quando a ordem
 * de leitura muda com a largura — o que `order` do CSS não resolve, porque ele move o pixel e deixa
 * o teclado e o leitor de tela na ordem antiga.
 *
 * `useSyncExternalStore` em vez de efeito + `setState`: o valor já sai certo no primeiro render.
 */
export function useMediaQuery(query: string): boolean {
  const list = useMemo(
    () => (typeof window === "undefined" ? null : window.matchMedia(query)),
    [query]
  )

  return useSyncExternalStore(
    useCallback(
      (onChange) => {
        list?.addEventListener("change", onChange)
        return () => list?.removeEventListener("change", onChange)
      },
      [list]
    ),
    () => list?.matches ?? false,
    () => false
  )
}

/** Evita disparar uma busca por tecla digitada. */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}

/** A busca recebe o sinal de cancelamento da tentativa a que pertence. */
export type AsyncFetcher<T> = (signal: AbortSignal) => Promise<T>

export type AsyncResourceOptions<T> = {
  /** Enquanto falso nada é buscado — um painel fechado não consulta o servidor. */
  enabled?: boolean
  /**
   * Mantém na tela os dados da busca anterior enquanto a nova não chega (e também quando ela falha).
   * Falso descarta os dados assim que uma nova busca começa: é o que impede um filtro novo de
   * mostrar, por um quadro, a lista do filtro antigo.
   */
  keepPreviousData?: boolean
  /** Efeitos que dependem da resposta. `silent` diz se veio de um recarregamento em segundo plano. */
  onSuccess?: (data: T, context: { silent: boolean }) => void
}

export type ReloadOptions = {
  /**
   * Recarrega em segundo plano: sem estado de carregamento, sem apagar o que está na tela e sem
   * exibir falha — os dados atuais continuam válidos e a próxima revalidação tenta de novo.
   */
  silent?: boolean
}

export type AsyncResource<T> = {
  data: T | null
  /** O erro cru da última tentativa visível; quem exibe traduz (`toMessage`). */
  error: unknown
  isLoading: boolean
  reload: (options?: ReloadOptions) => void
  /** Ajuste local dos dados já carregados (paginação que soma páginas, item que chega pelo tempo real). */
  setData: Dispatch<SetStateAction<T | null>>
}

/**
 * Carregamento assíncrono de uma fonte só: dados, erro, carregando, recarregar e cancelamento da
 * tentativa anterior — o mesmo contrato para todas as consultas da tela.
 *
 * Uma tentativa nova sempre cancela a anterior, então respostas fora de ordem nunca se aplicam por
 * cima de uma mais recente. Um recarregamento silencioso não atropela um carregamento em andamento:
 * ele já vai trazer dados novos.
 */
export function useAsyncResource<T>(
  fetcher: AsyncFetcher<T>,
  deps: readonly unknown[],
  options: AsyncResourceOptions<T> = {}
): AsyncResource<T> {
  const { enabled = true, keepPreviousData = false, onSuccess } = options

  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [isLoading, setIsLoading] = useState(enabled)

  // O que a busca precisa saber é sempre o do render mais recente, sem reassinar nada.
  const latest = useRef({ fetcher, onSuccess, keepPreviousData })
  useEffect(() => {
    latest.current = { fetcher, onSuccess, keepPreviousData }
  })

  const inFlight = useRef<AbortController | null>(null)
  const isLoadingRef = useRef(false)
  const attempt = useRef(0)

  const run = useCallback((silent: boolean) => {
    if (silent && isLoadingRef.current) return

    inFlight.current?.abort()
    const controller = new AbortController()
    inFlight.current = controller
    const id = ++attempt.current
    const current = () => id === attempt.current && !controller.signal.aborted

    if (!silent) {
      isLoadingRef.current = true
      setIsLoading(true)
      setError(null)
      if (!latest.current.keepPreviousData) setData(null)
    }

    latest.current
      .fetcher(controller.signal)
      .then((result) => {
        if (!current()) return
        setData(result)
        setError(null)
        latest.current.onSuccess?.(result, { silent })
      })
      .catch((failure: unknown) => {
        if (!current() || silent) return
        setError(failure)
      })
      .finally(() => {
        if (!current() || silent) return
        isLoadingRef.current = false
        setIsLoading(false)
      })
  }, [])

  const reload = useCallback((reloadOptions?: ReloadOptions) => run(reloadOptions?.silent ?? false), [run])

  useEffect(() => {
    if (!enabled) return
    run(false)
    return () => inFlight.current?.abort()
    // As dependências da busca são as que quem chama declarou; `run` é estável.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, run, ...deps])

  return { data, error, isLoading: enabled && isLoading, reload, setData }
}
