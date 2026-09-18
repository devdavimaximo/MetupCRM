import { describe, expect, it } from "vitest"

import type { ActivityType } from "@/features/activities/api"
import { taskTitle } from "./task-labels"

describe("taskTitle", () => {
  it.each<[ActivityType, string]>([
    ["Call", "Ligar para Padaria Aurora"],
    ["WhatsApp", "Enviar WhatsApp para Padaria Aurora"],
    ["Meeting", "Reunião com Padaria Aurora"],
    ["Proposal", "Enviar proposta para Padaria Aurora"],
    ["Note", "Nota sobre Padaria Aurora"],
  ])("%s → %s", (type, expected) => {
    expect(taskTitle({ type, companyName: "Padaria Aurora" })).toBe(expected)
  })
})
