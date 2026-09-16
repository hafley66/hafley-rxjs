// pkg:prove: with `reuseExisting`, a fixture root must rebuild when its own sources change. Fixture
// roots keep their sources beside `index.html` (`main.tsx`, `docs.ts`) rather than in `src/`, and
// `newest` of a path that does not exist is 0 — comparing the build against a missing `src` would make
// `newest(dist) >= 0` true forever and silently test a stale build.
import { mkdirSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, describe, expect, it } from "vitest"
import globalSetup from "../src/2_global-setup.js"

const root = join(tmpdir(), `pw-reuse-${process.pid}`)
afterAll(() => rmSync(root, { recursive: true, force: true }))

const newest = (dir: string): number => {
  let t = 0
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    t = Math.max(t, e.isDirectory() ? newest(p) : statSync(p).mtimeMs)
  }
  return t
}

const run = async (): Promise<number> => {
  process.env.VITEST_PLAYWRIGHT_SERVE = JSON.stringify({
    kind: "vite",
    build: { configFile: join(root, "vite.config.ts"), root },
    serve: "preview",
    reuseExisting: true,
  })
  try {
    const teardown = await globalSetup({ provide: () => {} })
    const built = newest(join(root, "dist"))
    await teardown()
    return built
  } finally {
    delete process.env.VITEST_PLAYWRIGHT_SERVE
  }
}

describe("serve reuse", () => {
  it("rebuilds a fixtures-layout root once a source is newer, and only then", async () => {
    rmSync(root, { recursive: true, force: true })
    mkdirSync(root, { recursive: true })
    writeFileSync(join(root, "index.html"), '<div id="app"></div><script type="module" src="/main.ts"></script>\n')
    writeFileSync(join(root, "main.ts"), 'document.getElementById("app")!.textContent = "one"\n')
    // No `defineConfig` import: a root in tmpdir has no node_modules for the config's own imports.
    writeFileSync(join(root, "vite.config.ts"), 'export default { build: { outDir: "dist" }, logLevel: "warn" }\n')
    const older = Date.now() / 1000 - 30
    utimesSync(join(root, "index.html"), older, older)
    utimesSync(join(root, "vite.config.ts"), older, older)

    const cold = await run()
    expect(cold).toBeGreaterThan(0)
    expect(await run()).toBe(cold)

    writeFileSync(join(root, "main.ts"), 'document.getElementById("app")!.textContent = "two"\n')
    expect(await run()).toBeGreaterThan(cold)
  })
})
