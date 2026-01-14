import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['../../vitest.setup.ts'],
    environment: 'jsdom',
  },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: '.',
  },
})
