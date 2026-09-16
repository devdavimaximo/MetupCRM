import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TooltipProvider } from "@/components/ui/tooltip"
import * as tasksApi from "@/features/tasks/api"
import type { TaskItem } from "@/features/tasks/api"
import { SideColumn } from "./dashboard-side"

const completeTask = vi.spyOn(tasksApi, "completeTask")

/**
 * Falha de chamada para um dublê. O `catch` vazio só diz ao runner que a rejeição tem dono — quem
 * a recebe de verdade é o componente, que continua vendo o erro.
 */
function rejection<T>(error: Error): Promise<T> {
  const failed = Promise.reject<T>(error)
  failed.catch(() => {})
  return failed
}

function task(overrides: Partial<TaskItem> = {}): TaskItem {
  return {
    id: "t1",
    dealId: "d1",
    companyId: "c1",
    companyName: "Padaria Aurora",
    type: "Call",
    dueDate: "2026-09-15T14:00:00Z",
    ownerUserId: "u1",
    ownerUserName: "Davi",
    note: null,
    status: "Pendente",
    createdAt: "2026-09-10T12:00:00Z",
    completedAt: null,
    ...overrides,
  }
}

function renderSide(props: Partial<Parameters<typeof SideColumn>[0]> = {}) {
  const onTaskCompleted = vi.fn()
  const onRetryTasks = vi.fn()
  const onSeeTasks = vi.fn()
  const utils = render(
    <TooltipProvider>
      <SideColumn
        events={[]}
        tasks={[task()]}
        overdueCount={0}
        tasksError={null}
        onRetryTasks={onRetryTasks}
        onOpenDeal={vi.fn()}
        onSeeTasks={onSeeTasks}
        onSeeAllActivity={vi.fn()}
        onTaskCompleted={onTaskCompleted}
        {...props}
      />
    </TooltipProvider>
  )
  return { ...utils, onTaskCompleted, onRetryTasks, onSeeTasks }
}

describe("fila de tarefas", () => {
  it("avisa o painel depois de concluir, para a fila ser reposta pelo servidor", async () => {
    completeTask.mockResolvedValue(task())
    const { onTaskCompleted } = renderSide()

    await userEvent.click(screen.getByRole("checkbox", { name: /Concluir Ligação com Padaria Aurora/ }))

    expect(completeTask).toHaveBeenCalledWith("t1")
    // A reposição vem do servidor, nunca de conta local: o painel só é avisado depois da saída da linha.
    await waitFor(() => expect(onTaskCompleted).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" })))
  })

  it("não avisa o painel quando concluir falha, e explica na própria linha", async () => {
    completeTask.mockImplementation(() => rejection(new Error("sem rede")))
    const { onTaskCompleted } = renderSide()

    await userEvent.click(screen.getByRole("checkbox", { name: /Concluir Ligação/ }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível concluir.")
    expect(onTaskCompleted).not.toHaveBeenCalled()
    // A linha continua lá, marcável de novo.
    expect(screen.getByRole("checkbox", { name: /Concluir Ligação/ })).toBeEnabled()
  })

  it("fila vazia convida a prospectar em vez de ficar muda", () => {
    renderSide({ tasks: [] })
    expect(screen.getByText("Nenhuma tarefa pendente. Bom momento para prospectar.")).toBeInTheDocument()
  })

  it("o alerta de atrasados leva para a tela de tarefas", async () => {
    const { onSeeTasks } = renderSide({ overdueCount: 3 })
    const alert = screen.getByRole("button", { name: /3 follow-ups atrasados/ })
    await userEvent.click(alert)
    expect(onSeeTasks).toHaveBeenCalled()
  })

  it("um atrasado só fala no singular", () => {
    renderSide({ overdueCount: 1 })
    expect(screen.getByRole("button", { name: /1 follow-up atrasado/ })).toBeInTheDocument()
  })
})

describe("erro isolado por fonte", () => {
  it("a falha das tarefas não apaga a Atividade Recente, e tem retry próprio", async () => {
    const events = [
      {
        id: "e1",
        kind: "DealWon" as const,
        dealId: "d1",
        companyName: "Padaria Aurora",
        actorName: "Davi",
        occurredAt: "2026-09-15T12:00:00Z",
        toStage: null,
        activityType: null,
        outcome: null,
        amount: 5000,
      },
    ]
    const { onRetryTasks } = renderSide({ tasks: null, tasksError: "Não foi possível carregar suas tarefas.", events })

    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar suas tarefas.")
    // A outra fonte continua de pé.
    expect(within(screen.getByRole("list")).getByText(/Padaria Aurora/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }))
    expect(onRetryTasks).toHaveBeenCalledTimes(1)
  })

  it("sem panorama, a Atividade Recente diz por que está vazia em vez de mentir 'nada aconteceu'", () => {
    renderSide({ events: null })
    expect(screen.getByText("Indisponível enquanto o panorama não carrega.")).toBeInTheDocument()
  })
})
