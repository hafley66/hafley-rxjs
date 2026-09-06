#!/usr/bin/env node
// boop-network CLI: reads the agent network export from the boop store through `boop db`,
// caps it to the newest N sessions, and writes both an NDJSON dump and a single-file HTML report.
import { parseArgs } from "node:util"
import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { AGENT_NETWORK_FRAMES_SQL, AGENT_NETWORK_ROWS_SQL, readAgentNetworkExport } from "./8_read.js"
import type { AgentNetworkExport } from "./0_types.js"

const DATA_PLACEHOLDER = "__BOOP_NETWORK_DATA__"
const MAX_BUFFER = 1024 * 1024 * 512

type ReportArgs = { out: string; dbCmd: string; limit: number }

function usage(): never {
  console.error("usage: boop-network report [--out DIR] [--db-cmd boop] [--limit 500]")
  process.exit(1)
}

function parseReportArgs(argv: string[]): ReportArgs {
  const { values } = parseArgs({
    args: argv,
    options: {
      out: { type: "string", default: "out" },
      "db-cmd": { type: "string", default: "boop" },
      limit: { type: "string", default: "500" },
    },
  })
  const limit = Number(values.limit)
  return { out: values.out as string, dbCmd: values["db-cmd"] as string, limit: Number.isFinite(limit) ? limit : 500 }
}

function sqlStringList(ids: string[]): string {
  if (!ids.length) return "''"
  return ids.map((id) => `'${id.replace(/'/g, "''")}'`).join(",")
}

function stripTrailingSemicolon(sql: string): string {
  return sql.replace(/;\s*$/, "")
}

// Caps the rows query to the newest `limit` sessions by wrapping it, then re-sorts ascending so
// downstream tree-building sees a stable, chronological order.
function buildCappedRowsSql(limit: number): string {
  const inner = stripTrailingSemicolon(AGENT_NETWORK_ROWS_SQL.replace(/:since/g, "0"))
  return `SELECT * FROM (SELECT * FROM (${inner}) ORDER BY COALESCE(openedTs, firstTurnTs, spawnedTs) DESC LIMIT ${limit}) ORDER BY COALESCE(openedTs, firstTurnTs, spawnedTs) ASC`
}

// Scopes the frames union to the capped session set: proportional to `--limit`, not the whole store.
function buildCappedFramesSql(sessionIds: string[]): string {
  const list = sqlStringList(sessionIds)
  const inner = stripTrailingSemicolon(AGENT_NETWORK_FRAMES_SQL.replace(/:since/g, "0").replace(":sessions", list))
  return `SELECT * FROM (${inner}) WHERE session IN (${list})`
}

function runBoopDb(dbCmd: string, query: string): string {
  return execFileSync(dbCmd, ["db", query, "--format", "ndjson"], { encoding: "utf8", maxBuffer: MAX_BUFFER })
}

function sessionIdsOf(ndjson: string): string[] {
  return ndjson
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("{"))
    .map((line) => (JSON.parse(line) as { session: string }).session)
}

// `boop db` has no bind-parameter facility: `:since`/`:sessions` error unless substituted first.
// readAgentNetworkExport always calls rows then frames, so this closure swaps in capped text by identity.
function makeSql(dbCmd: string, limit: number): (query: string) => string {
  let sessionIds: string[] = []
  return (query: string): string => {
    if (query === AGENT_NETWORK_ROWS_SQL) {
      const out = runBoopDb(dbCmd, buildCappedRowsSql(limit))
      sessionIds = sessionIdsOf(out)
      return out
    }
    if (query === AGENT_NETWORK_FRAMES_SQL) return runBoopDb(dbCmd, buildCappedFramesSql(sessionIds))
    return runBoopDb(dbCmd, query)
  }
}

function writeJsonl(out: string, data: AgentNetworkExport): void {
  const lines = [
    JSON.stringify({ record: "protocol", version: 1 }),
    ...data.rows.map((row) => JSON.stringify({ record: "row", ...row })),
    ...data.frames.map((frame) => JSON.stringify({ record: "frame", ...frame })),
  ]
  writeFileSync(`${out}/boop-network.jsonl`, `${lines.join("\n")}\n`)
}

function renderReport(data: AgentNetworkExport): string {
  const payload = { generated: new Date().toISOString(), rows: data.rows, frames: data.frames }
  // "</" inside a <script> block would end the block early.
  const inlineJson = JSON.stringify(payload).replace(/<\//g, "<\\/")
  const templateUrl = new URL("./report-template.html", import.meta.url)
  const template = readFileSync(templateUrl, "utf8")
  if (!template.includes(DATA_PLACEHOLDER)) {
    throw new Error(`report-template.html is missing the ${DATA_PLACEHOLDER} placeholder`)
  }
  return template.replace(DATA_PLACEHOLDER, () => inlineJson)
}

function runReport(argv: string[]): void {
  const { out, dbCmd, limit } = parseReportArgs(argv)
  mkdirSync(out, { recursive: true })
  const data = readAgentNetworkExport(makeSql(dbCmd, limit))
  writeJsonl(out, data)
  writeFileSync(`${out}/boop-network.html`, renderReport(data))
  console.log(`wrote ${out}/boop-network.jsonl and ${out}/boop-network.html (${data.rows.length} rows, ${data.frames.length} frames)`)
}

const [command, ...rest] = process.argv.slice(2)
if (command === "report") runReport(rest)
else usage()
