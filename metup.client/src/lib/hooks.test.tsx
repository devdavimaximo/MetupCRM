import { act, renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { useAsyncResource } from "./hooks"

/** Uma busca que só resolve quando o teste mandar — para observar o meio do caminho. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe("useAsyncResource", () => {
  it("carrega na montagem e expõe os dados", async () => {
    const { result } = renderHook(() => useAsyncResource(() => Promise.resolve("panorama"), []))

    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data).toBe("panorama")
    expect(result.current.error).toBeNull()
  })

  it("não busca nada enquanto estiver desligado", async () => {
    const fetcher = vi.fn(() => Promise.resolve("x"))
    const { result } = renderHook(() => useAsyncResource(fetcher, [], { enabled: false }))

    await act(async () => {})
    expect(fetcher).not.toHaveBeenCalled()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toBeNull()
  })

  it("busca assim que é ligado", async () => {
    const fetcher = vi.fn(() => Promise.resolve("x"))
    const { result, rerender } = renderHook(({ enabled }) => useAsyncResource(fetcher, [], { enabled }), {
      initialProps: { enabled: false },
    })

    rerender({ enabled: true })
    await waitFor(() => expect(result.current.data).toBe("x"))
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it("guarda o erro e, sem keepPreviousData, descarta os dados antigos", async () => {
    const failure = new Error("caiu")
    const { result, rerender } = renderHook(({ fail }) => useAsyncResource(() => (fail ? Promise.reject(failure) : Promise.resolve("ok")), [fail]), {
      initialProps: { fail: false },
    })

    await waitFor(() => expect(result.current.data).toBe("ok"))
    rerender({ fail: true })
    await waitFor(() => expect(result.current.error).toBe(failure))
    expect(result.current.data).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it("com keepPreviousData, o que está na tela sobrevive à falha", async () => {
    const failure = new Error("caiu")
    const { result, rerender } = renderHook(
      ({ fail }) => useAsyncResource(() => (fail ? Promise.reject(failure) : Promise.resolve("ok")), [fail], { keepPreviousData: true }),
      { initialProps: { fail: false } }
    )

    await waitFor(() => expect(result.current.data).toBe("ok"))
    rerender({ fail: true })
    await waitFor(() => expect(result.current.error).toBe(failure))
    expect(result.current.data).toBe("ok")
  })

  it("com keepPreviousData, os dados antigos ficam enquanto os novos não chegam", async () => {
    const pending = deferred<string>()
    const { result, rerender } = renderHook(
      ({ key }) => useAsyncResource(() => (key === 1 ? Promise.resolve("30 dias") : pending.promise), [key], { keepPreviousData: true }),
      { initialProps: { key: 1 } }
    )

    await waitFor(() => expect(result.current.data).toBe("30 dias"))
    rerender({ key: 2 })
    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBe("30 dias")

    await act(async () => pending.resolve("7 dias"))
    await waitFor(() => expect(result.current.data).toBe("7 dias"))
  })

  it("cancela a busca anterior quando as dependências mudam", async () => {
    const signals: AbortSignal[] = []
    const { rerender, result } = renderHook(
      ({ key }) =>
        useAsyncResource(
          (signal) => {
            signals.push(signal)
            return key === 1 ? new Promise<string>(() => {}) : Promise.resolve("segundo")
          },
          [key]
        ),
      { initialProps: { key: 1 } }
    )

    rerender({ key: 2 })
    await waitFor(() => expect(result.current.data).toBe("segundo"))
    expect(signals[0].aborted).toBe(true)
    expect(signals[1].aborted).toBe(false)
  })

  it("resposta atrasada da busca anterior não sobrescreve a mais recente", async () => {
    const slow = deferred<string>()
    const { rerender, result } = renderHook(({ key }) => useAsyncResource(() => (key === 1 ? slow.promise : Promise.resolve("novo")), [key]), {
      initialProps: { key: 1 },
    })

    rerender({ key: 2 })
    await waitFor(() => expect(result.current.data).toBe("novo"))

    await act(async () => slow.resolve("velho"))
    expect(result.current.data).toBe("novo")
  })

  it("cancela a busca em voo ao desmontar", async () => {
    const signals: AbortSignal[] = []
    const { unmount } = renderHook(() =>
      useAsyncResource((signal) => {
        signals.push(signal)
        return new Promise<string>(() => {})
      }, [])
    )

    unmount()
    expect(signals[0].aborted).toBe(true)
  })

  it("reload busca de novo e limpa o erro anterior", async () => {
    let attempt = 0
    const { result } = renderHook(() =>
      useAsyncResource(() => {
        attempt += 1
        return attempt === 1 ? Promise.reject(new Error("caiu")) : Promise.resolve("recuperado")
      }, [])
    )

    await waitFor(() => expect(result.current.error).not.toBeNull())
    act(() => result.current.reload())
    await waitFor(() => expect(result.current.data).toBe("recuperado"))
    expect(result.current.error).toBeNull()
  })

  it("reload silencioso não acende o carregando nem apaga os dados", async () => {
    const pending = deferred<string>()
    let attempt = 0
    const { result } = renderHook(() =>
      useAsyncResource(
        () => {
          attempt += 1
          return attempt === 1 ? Promise.resolve("antes") : pending.promise
        },
        [],
        { keepPreviousData: true }
      )
    )

    await waitFor(() => expect(result.current.data).toBe("antes"))
    act(() => result.current.reload({ silent: true }))
    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toBe("antes")

    await act(async () => pending.resolve("depois"))
    await waitFor(() => expect(result.current.data).toBe("depois"))
  })

  it("falha de reload silencioso não aparece na tela", async () => {
    let attempt = 0
    const { result } = renderHook(() =>
      useAsyncResource(
        () => {
          attempt += 1
          return attempt === 1 ? Promise.resolve("antes") : Promise.reject(new Error("rede caiu"))
        },
        [],
        { keepPreviousData: true }
      )
    )

    await waitFor(() => expect(result.current.data).toBe("antes"))
    await act(async () => {
      result.current.reload({ silent: true })
    })
    expect(result.current.error).toBeNull()
    expect(result.current.data).toBe("antes")
    expect(attempt).toBe(2)
  })

  it("reload silencioso não atropela um carregamento em andamento", async () => {
    const pending = deferred<string>()
    const fetcher = vi.fn(() => pending.promise)
    const { result } = renderHook(() => useAsyncResource(fetcher, []))

    act(() => result.current.reload({ silent: true }))
    expect(fetcher).toHaveBeenCalledTimes(1)

    await act(async () => pending.resolve("primeiro"))
    await waitFor(() => expect(result.current.data).toBe("primeiro"))
  })

  it("onSuccess diz se a resposta veio de um recarregamento silencioso", async () => {
    const seen: { data: string; silent: boolean }[] = []
    const { result } = renderHook(() =>
      useAsyncResource(() => Promise.resolve("evento"), [], {
        keepPreviousData: true,
        onSuccess: (data, { silent }) => seen.push({ data, silent }),
      })
    )

    await waitFor(() => expect(seen).toHaveLength(1))
    expect(seen[0]).toEqual({ data: "evento", silent: false })

    await act(async () => {
      result.current.reload({ silent: true })
    })
    await waitFor(() => expect(seen).toHaveLength(2))
    expect(seen[1]).toEqual({ data: "evento", silent: true })
  })

  it("setData ajusta os dados já carregados sem buscar de novo", async () => {
    const fetcher = vi.fn(() => Promise.resolve(["a"]))
    const { result } = renderHook(() => useAsyncResource(fetcher, []))

    await waitFor(() => expect(result.current.data).toEqual(["a"]))
    act(() => result.current.setData((items) => [...(items ?? []), "b"]))
    expect(result.current.data).toEqual(["a", "b"])
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
