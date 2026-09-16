// Fixture for the semaphore parity test: a real plugin instance whose slot dir comes from env, so the parent
// can point two child runs at the same slot files and watch them serialize (or not). A plain object (no
// `vitest/config` defineConfig) so this file, which sits under tests/**, does not pull @vitest/browser's
// jest-dom matcher types into the package typecheck graph where they collide with PlaywrightMatchers.
import { vitestPlaywright } from "../../../src/1_plugin.js"

export default {
  plugins: [
    vitestPlaywright({
      semaphore: {
        slots: Number(process.env.PW_SEMA_SLOTS ?? "1"),
        dir: process.env.PW_SEMA_DIR ?? "/tmp/pw-sema",
        staleMs: 60_000,
      },
      artifacts: { trace: "off", screenshot: "off" },
      log: { api: false, page: false, net: false },
    }),
  ],
  test: {
    include: ["fixture.test.ts"],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
}