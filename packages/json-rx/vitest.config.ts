import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
  test: { maxWorkers: 1, fileParallelism: false },
})
