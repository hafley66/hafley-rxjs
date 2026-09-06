// Pure process-row helpers for the nav tree adapter: command shortening, `ps`-walk ancestry
// parsing, folding process events into one row per pid, and picking a file's dominant project.
import type { Event } from '../../report/timeline.js'

export type ProcessRow = { pid: number; ppid: number | null; command: string; synthetic: boolean; spanCount: number; durationMs: number; t: number }

export function shortCommand(command: string): string {
  const [head, ...tail] = command.trim().split(/\s+/).filter(Boolean)
  if (!head) return '(unknown)'
  const bin = head.split('/').pop() ?? head
  const rest = tail.map((arg) => (arg.startsWith('-') ? arg : (arg.split('/').pop() ?? arg)))
  return [bin, ...rest].join(' ')
}

export function parseAncestry(ancestry: string[] | undefined): { pid: number; ppid: number; command: string }[] {
  return (ancestry ?? []).map((line) => {
    const [pid, ppid, ...rest] = line.trim().split(/\s+/)
    return { pid: Number(pid), ppid: Number(ppid), command: rest.join(' ') }
  })
}

export function collectProcessRows(rows: Event[]): Map<number, ProcessRow> {
  const byPid = new Map<number, ProcessRow>()
  for (const row of rows) {
    if (row.kind !== 'process' || row.pid == null) continue
    byPid.set(row.pid, {
      pid: row.pid,
      ppid: row.ppid ?? null,
      command: row.command ?? '',
      synthetic: false,
      spanCount: row.spanCount ?? 0,
      durationMs: row.durationMs ?? 0,
      t: row.t,
    })
  }
  for (const row of rows) {
    if (row.kind !== 'process') continue
    for (const ancestor of parseAncestry(row.ancestry)) {
      if (byPid.has(ancestor.pid) || Number.isNaN(ancestor.pid)) continue
      byPid.set(ancestor.pid, { pid: ancestor.pid, ppid: ancestor.ppid || null, command: ancestor.command, synthetic: true, spanCount: 0, durationMs: 0, t: row.t })
    }
  }
  return byPid
}

// Most common non-null project among a file's rows; a file usually resolves to exactly one.
export function projectOfRows(rows: Event[]): string | undefined {
  const counts = new Map<string, number>()
  for (const row of rows) {
    if (!row.project) continue
    counts.set(row.project, (counts.get(row.project) ?? 0) + 1)
  }
  let best: string | undefined
  let bestCount = 0
  for (const [project, count] of counts) {
    if (count > bestCount) {
      best = project
      bestCount = count
    }
  }
  return best
}
