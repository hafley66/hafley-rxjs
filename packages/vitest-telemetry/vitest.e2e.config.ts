import { defineConfig } from 'vitest/config'

// Raw playwright against the already-built out/report.html (`pnpm test` builds it), same style as
// fixtures/tests/e2e.harness.ts: no @playwright/test runner, no dev server, chromium headless.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'report-e2e',
          include: ['tests/report.e2e.test.ts', 'tests/report.shell.e2e.test.ts'],
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
})
