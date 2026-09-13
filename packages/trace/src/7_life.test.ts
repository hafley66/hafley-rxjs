import { describe, expect, it } from "vitest"
import { readdirSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { spawn } from "node:child_process"
import { ident } from "./1_ident.js"
import { endEdges, life$, reap, table } from "./7_life.js"

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, "..", "..", "..")

function tsxLoader(): string {
  const pnpm = join(root, "node_modules", ".pnpm")
  const entry = readdirSync(pnpm).find((d) => d.startsWith("tsx@"))
  if (entry === undefined) throw new Error("tsx not installed in this worktree")
  return resolve(pnpm, entry, "node_modules", "tsx", "dist", "loader.mjs")
}

function writeChild(name: string, body: string): string {
  const dir = mkdtempSync(join(tmpdir(), "hafley-life-"))
  const file = join(dir, name)
  writeFileSync(
    file,
    `import { ident } from ${JSON.stringify(resolve(here, "1_ident.ts"))}\n` +
      `import { life$ } from ${JSON.stringify(resolve(here, "7_life.ts"))}\n` +
      body,
  )
  return file
}

function collect(file: string, envExtra: Record<string, string>): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const run = spawn(process.execPath, ["--import", tsxLoader(), file], { env: { ...process.env, ...envExtra } })
    let out = ""
    let err = ""
    run.stdout.on("data", (d: Buffer) => { out += d.toString() })
    run.stderr.on("data", (d: Buffer) => { err += d.toString() })
    run.on("error", reject)
    run.on("close", (code) => {
      if (code !== 0) reject(new Error(`child exited ${code}:\n${err}`))
      else resolvePromise(out)
    })
  })
}

describe("life$ in a real node child", () => {
  it("emits a span, then a reported death when the process exits", async () => {
    const file = writeChild("life.ts", `
      const lines: string[] = []
      life$(ident({ service: "probe" })).subscribe({
        next: (s) => lines.push(JSON.stringify(s)),
        complete: () => process.stdout.write(lines.join("\\n") + "\\n"),
      })
      setTimeout(() => {}, 30)
    `)
    const out = await collect(file, {})
    const spans = out.trim().split("\n").map((l) => JSON.parse(l))
    expect(spans).toHaveLength(2)
    expect(spans[0]?.died).toBeUndefined()
    expect(spans[0]?.ident.service).toBe("probe")
    expect(spans[1]?.died.how).toBe("reported")
    expect(typeof spans[1]?.died.at).toBe("number")
    expect(spans[0]?.key).toBe(spans[1]?.key)
  })

  it("emits only the opening span for a child that is killed, and the reaper marks it dead by timeout", async () => {
    const file = writeChild("looper.ts", `
      const lines: string[] = []
      life$(ident({ service: "looper" })).subscribe({
        next: (s) => { lines.push(JSON.stringify(s)); process.stdout.write(lines.join("\\n") + "\\n") },
      })
      setInterval(() => {}, 1000)
    `)
    const run = spawn(process.execPath, ["--import", tsxLoader(), file], { env: { ...process.env } })
    const line = await new Promise<string>((resolvePromise) => {
      run.stdout.on("data", (d: Buffer) => resolvePromise(d.toString().trim()))
    })
    const opened = JSON.parse(line) as Parameters<typeof reap>[0][number]
    expect(opened.died).toBeUndefined()
    run.kill("SIGKILL")
    await new Promise((r) => run.on("close", r))
    const reaped = reap([opened], Date.now(), 0)
    expect(reaped[0]?.died?.how).toBe("timeout")
    expect(reaped[0]?.died?.at).toBe(opened.seen)
  })
})

const at = 1_700_000_000_000
const span = (over: Partial<{ key: string; died: Span["died"]; seen: number; born: number }>): Span => ({
  key: "k1@1",
  ident: ident({ service: "g", pid: "k1", born: at }),
  born: at,
  died: undefined,
  seen: at + 100,
  ...over,
})

describe("reap", () => {
  it("leaves a live or already-dead span alone", () => {
    const live = span({ key: "a@1", seen: at + 5000 })
    const dead = span({ key: "b@1", died: { at: at + 200, how: "reported" } })
    expect(reap([live, dead], at + 5000, 1000)).toEqual([live, dead])
  })

  it("marks a silent span dead at its last seen time", () => {
    const silent = span({ key: "a@1", seen: at + 100 })
    expect(reap([silent], at + 5000, 1000)[0]?.died).toEqual({ at: at + 100, how: "timeout" })
  })
})

describe("table", () => {
  it("folds spans and edges, last write winning per key", () => {
    const s1 = span({ key: "a@1" })
    const s2 = span({ key: "a@1", seen: at + 999 })
    const e1: Edge = { child: "c@1", parent: "a@1", since: at, until: undefined, cause: "spawn" }
    const e2: Edge = { ...e1, since: at + 50 }
    const out = table([s1, e1, s2, e2])
    expect(out.spans).toEqual([s2])
    expect(out.edges).toEqual([e2])
  })
})

describe("endEdges", () => {
  it("closes an edge whose parent died while the child still lives", () => {
    const parent = span({ key: "p@1", died: { at: at + 500, how: "reported" } })
    const child = span({ key: "c@1" })
    const edge: Edge = { child: "c@1", parent: "p@1", since: at, until: undefined, cause: "spawn" }
    expect(endEdges([parent, child], [edge])[0]?.until).toBe(at + 500)
  })

  it("leaves an edge alone when the parent lives or the child is dead", () => {
    const liveParent: Edge = { child: "c@1", parent: "p@1", since: at, until: undefined, cause: "spawn" }
    expect(endEdges([span({ key: "p@1" }), span({ key: "c@1" })], [liveParent])[0]?.until).toBeUndefined()
    const bothDead: Edge = { child: "c@1", parent: "p@1", since: at, until: undefined, cause: "spawn" }
    expect(endEdges(
      [span({ key: "p@1", died: { at: at + 1, how: "reported" } }), span({ key: "c@1", died: { at: at + 2, how: "reported" } })],
      [bothDead],
    )[0]?.until).toBeUndefined()
  })
})
