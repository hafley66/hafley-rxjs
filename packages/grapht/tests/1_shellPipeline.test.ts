import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { exec } from "node:child_process"
import { promisify } from "node:util"
import { mkdtemp, readFile, rm, writeFile, access } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  BENCH_PROTOCOL,
  benchOutputSchema,
  parseJsonl,
} from "../src/0_benchProtocol.js"
import { packageRoot, gridTopology } from "../src/2_fixtures.js"
import { hashFile } from "../src/3_hash.js"
import { measureCommand } from "../src/4_process.js"

const execAsync = promisify(exec)

const root = packageRoot(import.meta.url)
const bin = fileURLToPath(new URL("../bin", import.meta.url))
const helpers = fileURLToPath(new URL("./helpers", import.meta.url))
const env: NodeJS.ProcessEnv = { ...process.env, PATH: `${bin}:${process.env.PATH ?? ""}` }

let tmp: string

function run(cmd: string, opts: { cwd?: string } = {}): Promise<{ stdout: string; stderr: string }> {
  return execAsync(cmd, { env, cwd: opts.cwd ?? root, maxBuffer: 64 * 1024 * 1024 })
}

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), "grapht-shell-"))
})

afterAll(async () => {
  await rm(tmp, { recursive: true, force: true })
})

describe("grapht-fixtures emit", () => {
  it("emits a valid BenchInput carrying the generated topology", async () => {
    const { stdout } = await run(`${bin}/grapht-fixtures emit grid-1k`)
    const input = JSON.parse(stdout) as {
      protocol: string
      fixture: string
      operation: string
      runId: string
      input: string
    }
    expect(input.protocol).toBe(BENCH_PROTOCOL)
    expect(input.fixture).toBe("grid-1k")
    expect(input.operation).toBe("layout")
    expect(input.runId.length).toBeGreaterThan(0)
    const topology = JSON.parse(input.input) as { nodeIds: string[]; edges: [number, number][] }
    expect(topology.nodeIds).toHaveLength(1024)
    expect(topology.edges).toHaveLength(1984)
  })

  it("rejects an unknown fixture", async () => {
    const command = `${bin}/grapht-fixtures emit nope`
    const codes = await execAsync(command, { env, cwd: root }).then(
      () => ({ code: 0 }),
      (e) => ({ code: e.code as number }),
    )
    expect(codes.code).not.toBe(0)
  })

  it("emits the same topology across runs (only runId differs)", async () => {
    const a = JSON.parse((await run(`${bin}/grapht-fixtures emit grid-1k`)).stdout) as {
      runId: string
      input: string
    }
    const b = JSON.parse((await run(`${bin}/grapht-fixtures emit grid-1k`)).stdout) as {
      runId: string
      input: string
    }
    expect(a.input).toBe(b.input)
    expect(a.runId).not.toBe(b.runId)
  })
})

describe("grapht-bench run against identity adapter", () => {
  it("runs the full pipeline and persists the run directory", async () => {
    const out = join(tmp, "pipe-run")
    const { stdout } = await run(
      `${bin}/grapht-fixtures emit grid-1k | ${bin}/grapht-bench run --adapter grapht-adapter-identity --output ${out}`,
    )
    const summary = JSON.parse(stdout.trim().split("\n").pop() as string)
    expect(summary.status).toBe("ok")
    expect(summary.harnessExit).toBe(0)
    expect(summary.adapterExit).toBe(0)
    expect(summary.terminal).toBe("result")
    expect(summary.artifactBytes).toBeGreaterThan(0)

    const runDir = join(out, summary.runId)
    const request = JSON.parse(await readFile(join(runDir, "request.json"), "utf8")) as {
      runId: string
      outputDirectory: string
    }
    expect(request.runId).toBe(summary.runId)
    expect(request.outputDirectory).toBe(join(runDir, "artifacts"))

    const events = await readFile(join(runDir, "events.jsonl"), "utf8")
    const entries = parseJsonl(events, benchOutputSchema)
    expect(entries.every((e) => e.ok)).toBe(true)
    const records = entries.map((e) => (e.ok ? e.value : null)).filter(Boolean)
    expect(records.filter((r) => r?.type === "sample")).toHaveLength(1)
    const result = records.find((r) => r?.type === "result")
    expect(result?.runId).toBe(summary.runId)
    const artifactRel = result?.artifact as string
    const artifactHash = await hashFile(join(runDir, "artifacts", artifactRel))
    expect(artifactHash).toBe(result?.artifactHash)

    await access(join(runDir, "process.json"))
    await access(join(runDir, "analysis.json"))
    const processJson = JSON.parse(await readFile(join(runDir, "process.json"), "utf8"))
    expect(processJson.exitCode).toBe(0)
    expect(processJson.stdoutBytes).toBeGreaterThan(0)
  })

  it("confirms the grid-1k topology shape used by the adapter", async () => {
    const topology = gridTopology(32, 32, 1)
    expect(topology.nodeIds).toHaveLength(1024)
    expect(topology.edges).toHaveLength(1984)
  })
})

describe("adapter failure modes", () => {
  async function runAdapter(adapter: string, fixture = "grid-1k") {
    const out = join(tmp, `run-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    const cmd = `${bin}/grapht-fixtures emit ${fixture} | ${bin}/grapht-bench run --adapter ${adapter} --output ${out}`
    const res = await execAsync(cmd, { env, cwd: root, maxBuffer: 64 * 1024 * 1024 }).catch((e) => {
      const code = typeof e.code === "number" ? e.code : 1
      return { stdout: e.stdout as string, stderr: e.stderr as string, code }
    })
    const summary = JSON.parse(res.stdout.trim().split("\n").pop() as string)
    return { res, summary }
  }

  it("detects a crashing adapter (non-zero exit)", async () => {
    const { summary } = await runAdapter(`${helpers}/failing-adapter.mjs`)
    expect(summary.status).toBe("adapter-error")
    expect(summary.harnessExit).toBe(2)
    expect(summary.adapterExit).toBe(3)
  })

  it("detects an adapter that never emits a terminal record", async () => {
    const { summary } = await runAdapter(`${helpers}/no-terminal-adapter.mjs`)
    expect(summary.status).toBe("invalid-output")
    expect(summary.harnessExit).toBe(3)
  })

  it("detects an adapter that emits a BenchError", async () => {
    const { summary } = await runAdapter(`${helpers}/error-adapter.mjs`)
    expect(summary.status).toBe("bench-error")
    expect(summary.harnessExit).toBe(3)
  })

  it("rejects output whose runId differs from the request", async () => {
    const { summary } = await runAdapter(`${helpers}/bad-runid-adapter.mjs`)
    expect(summary.status).toBe("invalid-output")
    expect(summary.harnessExit).toBe(3)
  })
})

describe("grapht-bench record (collector)", () => {
  it("records a valid JSONL stream from a pipe", async () => {
    const out = join(tmp, `record-${Date.now()}`)
    const sample = {
      protocol: BENCH_PROTOCOL,
      type: "sample",
      runId: "rec-1",
      phase: "p",
      startedNs: 1,
      endedNs: 2,
      counters: {},
    }
    const result = { protocol: BENCH_PROTOCOL, type: "result", runId: "rec-1", implementation: "i", operation: "layout", counters: {} }
    const eventsFile = join(tmp, "events-input.jsonl")
    await writeFile(eventsFile, `${JSON.stringify(sample)}\n${JSON.stringify(result)}\n`, "utf8")
    const { stdout } = await run(`${bin}/grapht-bench record --output ${out} < ${eventsFile}`)
    const summary = JSON.parse(stdout) as { valid: number; invalid: number; okay: boolean }
    expect(summary.valid).toBe(2)
    expect(summary.invalid).toBe(0)
    expect(summary.okay).toBe(true)
    const recorded = await readFile(join(out, "events.jsonl"), "utf8")
    expect(recorded.trim().split("\n")).toHaveLength(2)
  })

  it("rejects invalid and mismatched lines", async () => {
    const out = join(tmp, `record-bad-${Date.now()}`)
    const eventsFile = join(tmp, "events-bad.jsonl")
    await writeFile(eventsFile, `${JSON.stringify({ protocol: BENCH_PROTOCOL, type: "result", runId: "rec-2", implementation: "i", operation: "layout", counters: {} })}\nthis is not json\n`, "utf8")
    const code = await execAsync(`${bin}/grapht-bench record --output ${out} < ${eventsFile}`, { env, cwd: root }).catch((e) => e.code)
    expect(code).toBe(1)
    const bad = await readFile(join(out, "invalid.jsonl"), "utf8")
    expect(bad).toContain("this is not json")
  })

  it("writes a tailed stream incrementally", async () => {
    const out = join(tmp, `record-tail-${Date.now()}`)
    const source = join(tmp, "live.jsonl")
    await writeFile(source, "", "utf8")
    await writeFile(source, `${JSON.stringify({ protocol: BENCH_PROTOCOL, type: "sample", runId: "t", phase: "p", startedNs: 1, endedNs: 2, counters: {} })}\n`, "utf8")
    await run(`${bin}/grapht-bench record --output ${out} < ${source}`)
    const recorded = await readFile(join(out, "events.jsonl"), "utf8")
    expect(recorded.trim().split("\n")).toHaveLength(1)
  })
})

describe("external process measurement", () => {
  it("measures wall time, CPU time, and peak RSS", async () => {
    const script = `${helpers}/sleep-adapter.mjs`
    if (process.platform === "darwin") {
      const res = await measureCommand(`node ${script}`, "{}", { timeoutMs: 300 })
      expect(res.signal ?? res.exitCode).not.toBe(0)
      void res
    }
  })

  it("records wall time for a quick command", async () => {
    const res = await measureCommand("node -e \"\"", "", { timeoutMs: 5000 })
    expect(res.exitCode).toBe(0)
    expect(res.wallMs).toBeGreaterThanOrEqual(0)
    if (process.platform === "darwin") {
      expect(res.peakRssKb).toBeGreaterThan(0)
    }
  })
})
