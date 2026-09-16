// pwp:harness. Child vitest-run spawner shared by every parity test. The parent is plain node (no
// playwright plugin): it runs a real `vitest run` on a fixture project that mounts the real plugin,
// collects stdout/stderr plus the child's JSON receipt files, and returns code + outputs for the
// parent to assert on. Machine safety: each spawn is pinned to one worker, serial files, and killed
// after 90s; callers never hold more than one child run at a time.
import { spawn } from "node:child_process"
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

export const pkgDir = fileURLToPath(new URL("../../", import.meta.url))
export const fixturesDir = join(pkgDir, "tests", "parity", "fixtures")
const vitestBin = join(pkgDir, "node_modules", ".bin", "vitest")

export interface ChildResult {
  code: number | null
  stdout: string
  stderr: string
  dir: string
}

/** A fresh empty receipts directory for one child run. */
export function freshReceiptsDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "pw-parity-"))
  return dir
}

export interface SpawnOptions {
  env?: Record<string, string>
  args?: string[]
  cwd?: string
  timeoutMs?: number
}

/** Run the fixture project at fixtures/<id> as a child vitest run and resolve with its outcome. */
export function runChild(id: string, opts: SpawnOptions = {}): Promise<ChildResult> {
  const dir = freshReceiptsDir()
  const cwd = opts.cwd ?? join(fixturesDir, id)
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PW_PARITY_RECEIPTS: dir,
    ...opts.env,
  }
  return new Promise((resolve, reject) => {
    const child = spawn(vitestBin, ["run", "--maxWorkers=1", "--no-file-parallelism", ...(opts.args ?? [])], {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", d => (stdout += d))
    child.stderr.on("data", d => (stderr += d))
    const killTimer = setTimeout(() => child.kill("SIGKILL"), opts.timeoutMs ?? 90_000)
    child.on("error", err => {
      clearTimeout(killTimer)
      reject(err)
    })
    child.on("close", code => {
      clearTimeout(killTimer)
      resolve({ code, stdout, stderr, dir })
    })
  })
}

/** Read a JSON receipt file written by a fixture test; returns undefined when absent. */
export function readReceipt<T>(dir: string, name: string): T | undefined {
  try {
    return JSON.parse(readFileSync(join(dir, name), "utf8")) as T
  } catch {
    return undefined
  }
}

export function receiptFiles(dir: string): string[] {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}

/** Write a JSON receipt line from inside a fixture test (child process). */
export function writeReceipt(name: string, value: unknown): void {
  const dir = process.env.PW_PARITY_RECEIPTS
  if (!dir) return
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, name), JSON.stringify(value))
}

/** Number of local browser launches via DEBUG=pw:browser `<launching>` lines. debug writes to stderr,
 *  so the whole child output is searched. */
export function countLaunches(r: ChildResult): number {
  const re = /pw:browser\s+<launching>/g
  const m = `${r.stdout}\n${r.stderr}`.match(re)
  return m ? m.length : 0
}
