import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { HANDLES_FILE } from "./1_config.js"

export type StoredRegion =
  | { kind: "controls"; tabId: number; controls: Record<string, unknown>[]; startIndex: number }
  | { kind: "text"; tabId: number; text: string }
  | { kind: "title"; tabId: number; title: string }
  | { kind: "json"; tabId: number | null; value: unknown }

export type HandleTable = { tabId?: number; controlCount?: number; regions: Record<string, StoredRegion> }

export function readHandles(): HandleTable {
  if (!existsSync(HANDLES_FILE)) return { regions: {} }
  try {
    return JSON.parse(readFileSync(HANDLES_FILE, "utf8")) as HandleTable
  } catch {
    return { regions: {} }
  }
}

export function writeHandles(table: HandleTable): void {
  mkdirSync(dirname(HANDLES_FILE), { recursive: true })
  writeFileSync(HANDLES_FILE, JSON.stringify(table))
}
