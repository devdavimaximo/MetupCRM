import { afterEach, describe, expect, it, vi } from "vitest"

import {
  addDays,
  addMonths,
  daysInclusive,
  endOfMonth,
  formatLocalDate,
  formatLocalRange,
  isLocalDate,
  parseLocalDate,
  startOfMonth,
  todayLocal,
  toLocalDate,
} from "./local-date"

afterEach(() => vi.useRealTimers())

describe("isLocalDate", () => {
  it("aceita uma data de calendário completa", () => {
    expect(isLocalDate("2026-09-15")).toBe(true)
  })

  it("recusa o que não é data, o formato curto e o instante", () => {
    for (const value of ["", "2026-9-15", "15/09/2026", "2026-09-15T00:00:00Z", null, undefined]) {
      expect(isLocalDate(value)).toBe(false)
    }
  })

  it("recusa dia que não existe no mês (não deixa transbordar)", () => {
    expect(isLocalDate("2026-02-30")).toBe(false)
    expect(isLocalDate("2026-13-01")).toBe(false)
  })

  it("aceita 29 de fevereiro em ano bissexto", () => {
    expect(isLocalDate("2028-02-29")).toBe(true)
    expect(isLocalDate("2026-02-29")).toBe(false)
  })
})

describe("parseLocalDate / toLocalDate", () => {
  it("não reconverte fuso: o dia continua o mesmo", () => {
    const date = parseLocalDate("2026-09-15")
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(8)
    expect(date.getDate()).toBe(15)
    expect(toLocalDate(date)).toBe("2026-09-15")
  })
})

describe("addDays", () => {
  it("atravessa a virada do mês e do ano", () => {
    expect(addDays("2026-09-15", 1)).toBe("2026-09-16")
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01")
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31")
  })

  it("é o que a janela móvel de N dias usa (hoje inclusive)", () => {
    expect(addDays("2026-09-15", -(30 - 1))).toBe("2026-08-17")
  })
})

describe("addMonths", () => {
  it("prende no último dia quando o mês de destino é mais curto", () => {
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28")
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28")
  })

  it("volta um mês a partir do primeiro dia", () => {
    expect(addMonths("2026-09-01", -1)).toBe("2026-08-01")
  })
})

describe("startOfMonth / endOfMonth", () => {
  it("delimita o mês, inclusive fevereiro bissexto", () => {
    expect(startOfMonth("2026-09-15")).toBe("2026-09-01")
    expect(endOfMonth("2026-09-15")).toBe("2026-09-30")
    expect(endOfMonth("2028-02-10")).toBe("2028-02-29")
  })
})

describe("daysInclusive", () => {
  it("conta as duas pontas", () => {
    expect(daysInclusive("2026-09-15", "2026-09-15")).toBe(1)
    expect(daysInclusive("2026-08-17", "2026-09-15")).toBe(30)
  })

  it("não se perde no horário de verão", () => {
    expect(daysInclusive("2026-01-01", "2026-12-31")).toBe(365)
  })
})

describe("formatLocalDate / formatLocalRange", () => {
  it("formata o dia sem reconverter fuso", () => {
    expect(formatLocalDate("2026-10-01")).toBe("01/10/2026")
  })

  it("omite o ano na ponta esquerda quando as duas estão no mesmo ano", () => {
    expect(formatLocalRange("2026-08-16", "2026-09-15")).toBe("16 ago – 15 set 2026")
  })

  it("mostra o ano nas duas pontas quando o intervalo cruza o ano", () => {
    expect(formatLocalRange("2025-12-20", "2026-01-05")).toBe("20 dez 2025 – 5 jan 2026")
  })

  it("um dia só aparece uma vez", () => {
    expect(formatLocalRange("2026-09-15", "2026-09-15")).toBe("15 set 2026")
  })
})

describe("todayLocal", () => {
  it("é o dia do relógio local, não o UTC", () => {
    // 15/09 às 22h em São Paulo já é 16/09 em UTC — o dia local tem que continuar sendo 15.
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-09-16T01:00:00Z"))
    expect(todayLocal()).toBe("2026-09-15")
  })
})
