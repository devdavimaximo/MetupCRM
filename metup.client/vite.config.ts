import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    // Testes unitários e de componente. Os de ponta a ponta são do Playwright (tests/e2e).
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    // Datas locais dependem do fuso de quem roda: fixo aqui para o resultado não mudar de máquina.
    env: { TZ: 'America/Sao_Paulo' },
  },
})
