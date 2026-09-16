import { defineConfig, devices } from "@playwright/test"

/**
 * Suíte visual e funcional do dashboard. A API é sempre dublada por `page.route` (fixtures em
 * `tests/e2e/fixtures`), então ela não precisa do back-end nem de banco: sobe só o front.
 *
 * Um projeto por largura — as asserções de layout (sem rolagem vertical, sem sobreposição) só fazem
 * sentido amarradas à janela em que valem.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  // O front é estático aqui: nada espera rede real, então o tempo curto pega travamento de verdade.
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: "http://localhost:5173",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "1366x768", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } } },
    { name: "1600x900", use: { ...devices["Desktop Chrome"], viewport: { width: 1600, height: 900 } } },
    { name: "1920x1080", use: { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 1080 } } },
    {
      name: "390x844",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: false, hasTouch: true },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
