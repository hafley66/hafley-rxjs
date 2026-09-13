import { describe, expect, it } from "vitest"
import { readdirSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { spawnSync } from "node:child_process"
import { ident, key } from "./1_ident.js"
import { childEnv, edge, workerName } from "./6_spawn.js"

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, "..", "..", "..")

// tsx is a transitive dependency here, not a top-level link, so `node --import tsx` cannot resolve
// it by name. Point node at tsx's loader by path so the child can import the real `.ts` sources,
// whose internal `.js` specifiers node's own type stripping would otherwise fail on.
function tsxLoader(): string {
  const pnpm = join(root, "node_modules", ".pnpm")
  const entry = readdirSync(pnpm).find((d) => d.startsWith("tsx@"))
  if (entry === undefined) throw new Error("tsx not installed in this worktree")
  return resolve(pnpm, entry, "node_modules", "tsx", "dist", "loader.mjs")
}

function childIdent(childEnvExtra: Record<string, string>): Record<string, unknown> {
  const script = mkdtempSync(join(tmpdir(), "hafley-spawn-"))
  const file = join(script, "child.ts")
  writeFileSync(
    file,
    `import { ident } from ${JSON.stringify(resolve(here, "1_ident.ts"))}\n` +
      `console.log(JSON.stringify(ident()))\n`,
  )
  const run = spawnSync(process.execPath, ["--import", tsxLoader(), file], {
    env: { ...process.env, ...childEnvExtra },
    encoding: "utf8",
  })
  if (run.status !== 0) throw new Error(`child failed:\n${run.stderr}`)
  return JSON.parse(run.stdout) as Record<string, unknown>
}

describe("parent handoff to a node child", () => {
  it("hands the parent key through the environment before the ppid fallback", () => {
    const me = ident({ service: "probe" })
    const child = childIdent(childEnv(me))
    expect(child["parent"]).toBe(me.pid)
    expect(child["parentBorn"]).toBe(Math.round(me.born))
  })
})

describe("spawn helpers", () => {
  it("prints the parent key into the env", () => {
    const me = ident({ service: "probe", pid: "99", born: 1700000000000 })
    expect(childEnv(me)).toEqual({ HAFLEY_TRACE_PARENT: key(me) })
  })

  it("formats the worker name with the key, not a bare pid", () => {
    const me = ident({ service: "probe", pid: "99", born: 1700000000000 })
    expect(workerName(me, "sorter")).toBe("hafley:99@1700000000000:sorter")
  })

  it("states its own edge, or none when it has no parent key", () => {
    const child = ident({ parent: "17", parentBorn: 1700000000000, pid: "42", born: 1700000001000 })
    expect(edge(child, "spawn")).toEqual({
      child: "42@1700000001000",
      parent: "17@1700000000000",
      since: 1700000001000,
      until: undefined,
      cause: "spawn",
    })
    expect(edge(ident({ parent: "17", parentBorn: undefined }), "spawn")).toBeUndefined()
  })
})
