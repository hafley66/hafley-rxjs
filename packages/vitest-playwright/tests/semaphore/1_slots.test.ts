// Integration through the real binary: two real `vitest run` children on the fixture project, pointing at the
// same slot dir. slots:1 must serialize the two browser lifetimes (the later launch happens only after the
// earlier close); slots:2 lets them overlap. No mocks, no fake locks, no stubbed playwright.
import { spawn, type ChildProcess } from "node:child_process"
import { mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { test, expect } from "vitest"

const here = fileURLToPath(new URL(".", import.meta.url))
const root = join(here, "..", "..", "..", "..")
const vitestBin = join(root, "node_modules", ".bin", "vitest")
const fixtureConfig = join(here, "fixtures", "vitest.config.ts")
const fixtureDir = join(here, "fixtures")

interface Events {
  launch: number
  close: number
}

function readEvents(log: string): Events {
  const lines = readFileSync(log, "utf8").trim().split("\n").filter(Boolean)
  const out: Partial<Events> = {}
  for (const line of lines) {
    const ev = JSON.parse(line) as { event: "launch" | "close"; t: number }
    out[ev.event] = ev.t
  }
  if (out.launch === undefined || out.close === undefined)
    throw new Error(`child log ${log} missing launch/close: ${JSON.stringify(lines)}`)
  return { launch: out.launch, close: out.close }
}

function runChild(opts: {
  slots: number
  dir: string
  log: string
  onData?: (chunk: string) => void
}): { promise: Promise<number>; proc: ChildProcess } {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PW_SEMA_SLOTS: String(opts.slots),
    PW_SEMA_DIR: opts.dir,
    PW_SEMA_LOG: opts.log,
  }
  const proc = spawn(
    vitestBin,
    ["run", "--config", fixtureConfig, "--maxWorkers=1", "--no-file-parallelism"],
    { cwd: fixtureDir, stdio: "pipe", env },
  )
  proc.stdout.on("data", d => opts.onData?.(String(d)))
  proc.stderr.on("data", d => opts.onData?.(String(d)))
  const promise = new Promise<number>(resolve => {
    const timer = setTimeout(() => {
      proc.kill("SIGKILL")
      resolve(124)
    }, 90_000)
    proc.on("exit", (status, signal) => {
      clearTimeout(timer)
      resolve(signal ? 1 : (status ?? 1))
    })
    proc.on("error", err => {
      clearTimeout(timer)
      opts.onData?.(`spawn error: ${String(err)}`)
      resolve(127)
    })
  })
  return { promise, proc }
}

async function runPair(slots: number, capture: string[]): Promise<{ code1: number; code2: number; e1: Events; e2: Events }> {
  const dir = mkdtempSync(join(tmpdir(), "pw-sema-"))
  const log1 = join(dir, "child1.jsonl")
  const log2 = join(dir, "child2.jsonl")
  const c1 = runChild({ slots, dir, log: log1, onData: d => capture.push(d) })
  const c2 = runChild({ slots, dir, log: log2, onData: d => capture.push(d) })
  const [code1, code2] = await Promise.all([c1.promise, c2.promise])
  return { code1, code2, e1: readEvents(log1), e2: readEvents(log2) }
}

test("slots:1 serializes two child browser lifetimes", async () => {
  const capture: string[] = []
  const { code1, code2, e1, e2 } = await runPair(1, capture)
  const output = capture.join("\n")
  expect(code1, `child1 failed:\n${output}`).toBe(0)
  expect(code2, `child2 failed:\n${output}`).toBe(0)
  const first = e1.launch <= e2.launch ? e1 : e2
  const second = first === e1 ? e2 : e1
  expect(second.launch).toBeGreaterThanOrEqual(first.close)
})

test("slots:2 lets two child browser lifetimes overlap", async () => {
  const capture: string[] = []
  const { code1, code2, e1, e2 } = await runPair(2, capture)
  const output = capture.join("\n")
  expect(code1, `child1 failed:\n${output}`).toBe(0)
  expect(code2, `child2 failed:\n${output}`).toBe(0)
  const first = e1.launch <= e2.launch ? e1 : e2
  const second = first === e1 ? e2 : e1
  expect(second.launch).toBeLessThan(first.close)
})