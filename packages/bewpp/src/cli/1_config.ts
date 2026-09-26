import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { realpathSync } from "node:fs"

export const TOKEN_FILE = process.env.BEWPP_TOKEN_FILE ?? join(homedir(), "projects/bewpp-bridge/local-data/extension-token")
export const SHOT_DIR = process.env.BEWPP_SHOT_DIR ?? join(homedir(), ".cache/bewpp")
export const STATE_FILE = process.env.BEWPP_STATE_FILE ?? join(SHOT_DIR, "bridge.json")
export const HANDLES_FILE = join(SHOT_DIR, "handles.json")

export function bridgeUrl(): string {
  if (process.env.BEWPP_BRIDGE_URL) return process.env.BEWPP_BRIDGE_URL
  if (existsSync(STATE_FILE)) {
    try {
      const value = JSON.parse(readFileSync(STATE_FILE, "utf8")) as { url?: unknown }
      if (typeof value.url === "string" && value.url) return value.url
    } catch {}
  }
  return "http://127.0.0.1:0"
}

export function readToken(): string {
  if (!existsSync(TOKEN_FILE)) throw new Error(`no token at ${TOKEN_FILE}. Start the bridge and pair the extension.`)
  const token = readFileSync(TOKEN_FILE, "utf8").replace(/\s+/g, "")
  if (!token) throw new Error("token file is empty. Re-pair the extension.")
  return token
}

function configuredBudget(): number | undefined {
  const entry = process.argv[1]
  if (!entry) return undefined
  const configPath = join(dirname(realpathSync(entry)), "bew.config.json")
  if (!existsSync(configPath)) return undefined
  const config = JSON.parse(readFileSync(configPath, "utf8"))
  return typeof config.budget === "number" ? config.budget : undefined
}

/** Resolution order: --budget flag, BEW_BUDGET env, bew.config.json beside the resolved binary, then 600. */
export function resolveBudget(flagValue: string | undefined): number {
  if (flagValue !== undefined) {
    const n = Number(flagValue)
    if (!Number.isFinite(n)) throw new Error(`--budget must be a number, got '${flagValue}'`)
    return n
  }
  const env = process.env.BEW_BUDGET
  if (env !== undefined && env !== "") {
    const n = Number(env)
    if (Number.isFinite(n)) return n
  }
  const fromConfig = configuredBudget()
  return fromConfig ?? 600
}
