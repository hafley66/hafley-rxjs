// Which rows the header's window select shows, and the header count line.
// "active" delegates to lib/status.ts's isActive so the window and status word never drift.
import { isActive } from "./status.js"

export type TimeWindow = "active" | "live" | "today" | "7d" | "all"

const WINDOW_HOURS: Record<"today" | "7d", number> = { today: 24, "7d": 24 * 7 }
const HOUR_MS = 60 * 60 * 1000

export type WindowActivity = { live: boolean; lastActivityTs: number | null; openedTs: number | null }

function activityTs(row: WindowActivity): number | null {
  return row.lastActivityTs ?? row.openedTs
}

function isRecentWithin(row: WindowActivity, hours: number, now: number): boolean {
  const ts = activityTs(row)
  return ts !== null && now - ts <= hours * HOUR_MS
}

export function matchesWindow(row: WindowActivity, window: TimeWindow, now: number): boolean {
  if (window === "all") return true
  if (window === "active") return isActive({ live: row.live, lastActivityTs: row.lastActivityTs, now })
  if (window === "live") return row.live
  return isRecentWithin(row, WINDOW_HOURS[window], now)
}

export function sortByRecencyDesc<T extends WindowActivity>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (activityTs(b) ?? -Infinity) - (activityTs(a) ?? -Infinity))
}

export function partitionWindow<T extends WindowActivity>(rows: T[], window: TimeWindow, now: number): { within: T[]; older: T[] } {
  const within: T[] = []
  const older: T[] = []
  for (const row of rows) (matchesWindow(row, window, now) ? within : older).push(row)
  return { within, older }
}

export type HeaderCounts = { active: number; live: number; today: number; total: number }

// Overlapping, not partitioned: a row can count toward active, live, and today all at once.
export function countHeader(rows: WindowActivity[], now: number): HeaderCounts {
  const counts: HeaderCounts = { active: 0, live: 0, today: 0, total: rows.length }
  for (const row of rows) {
    if (matchesWindow(row, "active", now)) counts.active += 1
    if (row.live) counts.live += 1
    if (matchesWindow(row, "today", now)) counts.today += 1
  }
  return counts
}
