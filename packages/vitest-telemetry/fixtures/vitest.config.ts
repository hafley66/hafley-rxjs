import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'
import { telemetry } from '../src/plugin.ts'

// `test.mergeReports` cannot be set here: vitest treats any config-level value as "run in merge
// mode", which breaks the plain shard runs. The merge step passes --merge-reports on the CLI
// instead, so blob reports use vitest's own default location (.vitest-reports/blob-<n>-<m>.json)
// and are picked up from there by that same default on the merge run.
// otlp:14318, not the 4318 default: this machine already has something bound to 4318 (Docker
// Desktop's own OTLP endpoint). The port is a plain consumer option, not a package default change.
export default defineConfig({
  plugins: [telemetry({ root: 'lab', otlp: 'http://localhost:14318' })],
  test: {
    attachmentsDir: 'out/attachments',
    reporters: ['default', 'blob', ['junit', { outputFile: process.env.JUNIT_OUT ?? 'out/junit.xml' }]],
    projects: [
      {
        extends: true,
        test: { name: 'node', include: ['fixtures/tests/*.node.test.ts'] },
      },
      {
        extends: true,
        test: { name: 'e2e', include: ['fixtures/tests/*.e2e.test.ts'], testTimeout: 60_000, hookTimeout: 60_000 },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['fixtures/tests/*.browser.test.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
            trace: { mode: 'on', tracesDir: 'out/pw-traces' },
          },
        },
      },
    ],
  },
})
