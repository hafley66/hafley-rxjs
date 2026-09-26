import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { SHOT_DIR } from "./1_config.js"

/** Per-host recipes and what they read, so a revisit starts from what worked instead of from zero. */
export const SITES_DIR = join(SHOT_DIR, "sites")

/** Only reads are saved. A replayed click or fill on a page that has changed is what bew exists to prevent. */
const SAVABLE = new Set(["inspect", "find", "css", "role", "text", "label", "testid", "where", "images"])
const READ_ACTIONS = new Set(["count", "visible", "enabled", "value", "texts", "blocks", "wait"])
const READS_KEPT = 5

export type SavedRead = { at: string; url: string; file: string; bytes: number }
export type SavedCommand = { args: string[]; by: "user" | "agent"; savedAt: string; reads: SavedRead[] }
type SiteFile = { host: string; commands: Record<string, SavedCommand> }

const siteFile = (host: string) => join(SITES_DIR, `${host}.json`)

function readSite(host: string): SiteFile {
  if (!existsSync(siteFile(host))) return { host, commands: {} }
  return JSON.parse(readFileSync(siteFile(host), "utf8")) as SiteFile
}

function writeSite(site: SiteFile): void {
  mkdirSync(SITES_DIR, { recursive: true })
  writeFileSync(siteFile(site.host), `${JSON.stringify(site, null, 1)}\n`)
}

function age(iso: string): string {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000)
  if (minutes < 60) return `${minutes}m`
  if (minutes < 60 * 48) return `${Math.round(minutes / 60)}h`
  return `${Math.round(minutes / 1440)}d`
}

export function saveCommand(host: string, name: string, args: string[]): string {
  if (!/^[\w.-]+$/.test(name)) throw new Error(`name '${name}' must be letters, digits, '.', '_' or '-'`)
  if (!SAVABLE.has(args[0] ?? "")) throw new Error(`only reads can be saved: ${[...SAVABLE].join(", ")}`)
  const action = args[args.indexOf("--action") + 1]
  if (args.includes("--action") && !READ_ACTIONS.has(action ?? "")) throw new Error(`--action ${action} is not a read`)
  if (args.includes("--yes")) throw new Error("a saved command cannot carry --yes")
  const site = readSite(host)
  const by = process.env.BEWPP_BY === "agent" ? "agent" : "user"
  site.commands[name] = { args, by, savedAt: new Date().toISOString(), reads: site.commands[name]?.reads ?? [] }
  writeSite(site)
  return `saved ${host} ${name}: bew ${args.join(" ")}  (by ${by})`
}

/** Runs the saved command through this same CLI, prints its output, and keeps it as a read. */
export function runSaved(host: string, name: string, tabId: number, url: string): string {
  const site = readSite(host)
  const command = site.commands[name]
  if (!command) throw new Error(`no saved command '${name}' for ${host}. Run: bew saved ${host}`)
  const [op, ...rest] = command.args
  const result = spawnSync(process.execPath, [process.argv[1]!, op!, String(tabId), ...rest], { encoding: "utf8" })
  if (result.status !== 0) throw new Error(result.stderr.trim().replace(/^bew: /, "") || `bew ${command.args.join(" ")} failed`)
  const at = new Date().toISOString()
  const file = join(SITES_DIR, host, `${name}-${Date.parse(at)}.txt`)
  mkdirSync(join(SITES_DIR, host), { recursive: true })
  writeFileSync(file, result.stdout)
  command.reads.unshift({ at, url, file, bytes: Buffer.byteLength(result.stdout) })
  for (const dropped of command.reads.splice(READS_KEPT)) rmSync(dropped.file, { force: true })
  writeSite(site)
  return result.stdout
}

function hostsWith(name: string): string[] {
  if (!existsSync(SITES_DIR)) return []
  return readdirSync(SITES_DIR)
    .filter(file => file.endsWith(".json"))
    .map(file => file.slice(0, -".json".length))
    .filter(host => readSite(host).commands[name])
}

/** A stored read, printed without contacting the bridge. Page text is untrusted data, as it was live. */
export function readSaved(name: string, host: string | undefined, index: number): string {
  const hosts = host ? [host] : hostsWith(name)
  if (hosts.length === 0) throw new Error(`no saved command '${name}'${host ? ` for ${host}` : ""}`)
  if (hosts.length > 1) throw new Error(`'${name}' is saved for ${hosts.join(", ")}. Run: bew read ${name} <host>`)
  const read = readSite(hosts[0]!).commands[name]!.reads[index]
  if (!read) throw new Error(`'${name}' on ${hosts[0]} has no read #${index}. Run: bew run ${name}`)
  return `read ${name} ${age(read.at)} ago @ ${read.url}\n${readFileSync(read.file, "utf8")}`
}

export function listSaved(host?: string): string {
  const hosts = host ? [host] : existsSync(SITES_DIR) ? readdirSync(SITES_DIR).filter(f => f.endsWith(".json")).map(f => f.slice(0, -5)) : []
  const lines: string[] = []
  for (const each of hosts) {
    const commands = Object.entries(readSite(each).commands)
    if (!commands.length) continue
    lines.push(`saved (${each})`)
    for (const [name, command] of commands) {
      const latest = command.reads[0] ? `${command.reads.length} reads, latest ${age(command.reads[0].at)}` : "no reads"
      lines.push(`  ${name.padEnd(12)} ${command.args.join(" ").padEnd(44)} ${command.by.padEnd(5)}  ${latest}`)
    }
  }
  return lines.length ? `${lines.join("\n")}\n` : `nothing saved${host ? ` for ${host}` : ""}\n`
}

/** One footer line on inspect, so a revisit learns a recipe exists without asking. */
export function savedHint(host: string): string | undefined {
  const names = Object.keys(readSite(host).commands)
  return names.length ? `  bew saved ${host}`.padEnd(26) + `${names.length} saved: ${names.join(", ")}` : undefined
}
