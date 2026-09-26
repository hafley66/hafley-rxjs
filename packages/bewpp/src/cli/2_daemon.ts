import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { SHOT_DIR, STATE_FILE } from "./1_config.js"

export type DaemonRecord = { pid: number; url: string; hash: string; startedAt: string }
type BridgeState = { pid: number; url: string; startedAt: string }

const PID_FILE = join(SHOT_DIR, "bridge.pid")
const LOG_FILE = join(SHOT_DIR, "bridge.log")

/** The bridge entry is resolved from this bundle's own location so any cwd works. */
function bridgeEntry(): string {
  const here = dirname(fileURLToPath(import.meta.url))
  const fromEnv = process.env.BEWPP_BRIDGE_ENTRY
  if (fromEnv) return resolve(fromEnv)
  return resolve(here, "../../../../bewpp-bridge/0_bridge.mjs")
}

/** Identity of the code the bridge would load, so a rebuilt package reads as a different bridge. */
export function buildHash(): string {
  const here = dirname(fileURLToPath(import.meta.url))
  const digest = createHash("sha256")
  for (const file of [join(here, "index.js"), join(here, "cli.js"), bridgeEntry()]) {
    digest.update(existsSync(file) ? readFileSync(file) : Buffer.from(file))
  }
  return digest.digest("hex").slice(0, 12)
}

/** Chrome caches the loaded extension, so a rebuilt one only takes effect after a manual reload. */
export function extensionBuild(): { id: string; builtAt: Date } | undefined {
  const dir = process.env.BEWPP_EXTENSION_DIR ?? resolve(dirname(bridgeEntry()), "extension")
  const hooks = join(dir, "page-hooks.js")
  if (!existsSync(hooks)) return undefined
  const found = /"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"/.exec(readFileSync(hooks, "utf8"))
  if (!found) return undefined
  return { id: found[1], builtAt: statSync(hooks).mtime }
}

export function reloadNotice(): string {
  const build = extensionBuild()
  if (!build) return ""
  return [
    `extension built ${build.id} at ${build.builtAt.toLocaleTimeString()}.`,
    "If you have not reloaded since then:",
    "  1. chrome://extensions -> reload bewpp",
    "  2. reload any tab you want to drive, so it picks up the new content scripts",
  ].join("\n")
}

export function readRecord(): DaemonRecord | undefined {
  if (!existsSync(PID_FILE)) return undefined
  try {
    return JSON.parse(readFileSync(PID_FILE, "utf8")) as DaemonRecord
  } catch {
    return undefined
  }
}

function readBridgeState(): BridgeState | undefined {
  if (!existsSync(STATE_FILE)) return undefined
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8")) as BridgeState
  } catch {
    return undefined
  }
}

export function alive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM"
  }
}

async function listening(url: string): Promise<boolean> {
  try {
    const response = await fetch(new URL("/status", url), { signal: AbortSignal.timeout(1500) })
    return response.ok
  } catch {
    return false
  }
}

export async function status(url: string): Promise<{
  state: "running" | "stale" | "dead" | "stopped"
  record?: DaemonRecord
  expected: string
  up: boolean
}> {
  const expected = buildHash()
  const record = readRecord()
  const liveUrl = record?.url ?? readBridgeState()?.url ?? url
  if (!record) return { state: (await listening(liveUrl)) ? "dead" : "stopped", expected, up: await listening(liveUrl) }
  const up = alive(record.pid) && (await listening(record.url))
  if (!up) return { state: "dead", record, expected, up }
  return { state: record.hash === expected ? "running" : "stale", record, expected, up }
}

export async function stop(url: string): Promise<string> {
  const record = readRecord()
  if (!record) {
    rmSync(PID_FILE, { force: true })
    return "no pid file; nothing to stop"
  }
  if (alive(record.pid)) {
    try {
      process.kill(record.pid, "SIGTERM")
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") {
        throw new Error(`cannot stop bridge pid ${record.pid}: permission denied (EPERM)`)
      }
      // already gone between the check and the signal
    }
    for (let waited = 0; waited < 5000 && alive(record.pid); waited += 100) {
      await new Promise(done => setTimeout(done, 100))
    }
    if (alive(record.pid)) {
      try {
        process.kill(record.pid, "SIGKILL")
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EPERM") {
          throw new Error(`cannot stop bridge pid ${record.pid}: permission denied (EPERM)`)
        }
        throw error
      }
    }
  }
  rmSync(PID_FILE, { force: true })
  void url
  return `stopped pid ${record.pid}`
}

export async function start(url: string): Promise<string> {
  const current = await status(url)
  if (current.state === "running") return `already running, pid ${current.record?.pid}`
  if (current.record || current.up) await stop(url)

  const entry = bridgeEntry()
  if (!existsSync(entry)) throw new Error(`bridge entry not found at ${entry}. Set BEWPP_BRIDGE_ENTRY.`)
  mkdirSync(SHOT_DIR, { recursive: true })
  const log = openSync(LOG_FILE, "a")
  const child = spawn(process.execPath, [entry], {
    cwd: dirname(entry),
    detached: true,
    stdio: ["ignore", log, log],
    env: { ...process.env, BEWPP_BRIDGE_STATE_FILE: STATE_FILE },
  })
  child.unref()
  if (child.pid == null) throw new Error("the bridge process did not start")

  const startedAt = new Date().toISOString()
  for (let waited = 0; waited < 8000; waited += 150) {
    const state = readBridgeState()
    if (state?.pid === child.pid && await listening(state.url)) {
      const record: DaemonRecord = { pid: child.pid, url: state.url, hash: buildHash(), startedAt }
      writeFileSync(PID_FILE, JSON.stringify(record))
      return `started pid ${child.pid} at ${state.url}`
    }
    if (!alive(child.pid)) throw new Error(`the bridge exited on startup. See ${LOG_FILE}`)
    await new Promise(done => setTimeout(done, 150))
  }
  throw new Error(`the bridge did not answer ${url} within 8s. See ${LOG_FILE}`)
}

export async function restart(url: string): Promise<string> {
  await stop(url)
  const started = await start(url)
  const notice = reloadNotice()
  return notice ? `${started}\n${notice}` : started
}

/** Restart when the running bridge was spawned from different code than this CLI was built from. */
export async function ensureFresh(url: string): Promise<string | undefined> {
  const current = await status(url)
  if (current.state === "running") return undefined
  if (current.state === "stopped") return `bridge not running. Start it with: bew bridge start`
  if (current.state === "dead") return `bridge is not answering. Restart it with: bew bridge restart`
  return `bridge is stale (built ${current.record?.hash}, CLI expects ${current.expected}). Run: bew bridge restart`
}
