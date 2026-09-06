// Events with no OS process of their own (browser page spans, junit verdicts) still belong to a
// process: whoever opened the trace context they run in. Walk parentSpanId until a span that
// carries a pid; failing that, the vitest main process of the same shard; failing that, the
// earliest process seen. The nav uses this so every test hangs off "who made who".
import type { Event } from '../../report/timeline.js'

const MAX_HOPS = 32

export type HostIndex = {
  spanById: Map<string, Event>
  mainPidByShard: Map<string, number>
  fallbackPid: number | null
}

function isVitestMain(command: string | undefined): boolean {
  return /vitest(\.mjs)?(\s|$)/.test(command ?? '') && !/forks\.js|threads\.js/.test(command ?? '')
}

export function buildHostIndex(rows: Event[]): HostIndex {
  const spanById = new Map<string, Event>()
  for (const e of rows) if (e.spanId) spanById.set(e.spanId, e)

  const processes = rows.filter((e) => e.kind === 'process' && e.pid != null).sort((a, b) => a.t - b.t)
  const mainPidByShard = new Map<string, number>()
  for (const p of processes) {
    if (p.shard && isVitestMain(p.command) && !mainPidByShard.has(p.shard)) mainPidByShard.set(p.shard, p.pid!)
  }
  return { spanById, mainPidByShard, fallbackPid: processes[0]?.pid ?? null }
}

export function hostPidOf(event: Event, index: HostIndex): number | null {
  if (event.pid != null) return event.pid
  let current: Event | undefined = event
  for (let hop = 0; current && hop < MAX_HOPS; hop++) {
    if (current.pid != null) return current.pid
    current = current.parentSpanId ? index.spanById.get(current.parentSpanId) : undefined
  }
  if (event.shard && index.mainPidByShard.has(event.shard)) return index.mainPidByShard.get(event.shard)!
  return index.fallbackPid
}
