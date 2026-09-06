// Event[] -> Chrome trace event format (out/trace.json). Open in https://ui.perfetto.dev or
// chrome://tracing, file stays local.
// process = shard/project, thread = realm/file. spans = X slices (nested by time), logs,
// playwright lines and verdicts = instant events with args.
import type { Event } from './timeline.js'

interface TraceEvent {
  ph: string
  pid?: number
  tid?: number
  name?: string
  ts?: number
  s?: string
  cat?: string
  dur?: number
  args?: Record<string, unknown>
  cname?: string
}

function processKey(event: Event): string {
  if (event.kind === 'playwright') return 'playwright driver'
  if (event.kind === 'verdict') return 'junit verdicts'
  if (event.project) return `shard ${event.shard ?? '?'} · ${event.project}`
  return `shard ${event.shard ?? '?'} · run-level`
}

function threadKey(event: Event): string {
  if (event.kind === 'playwright') return 'pw:api'
  return `${event.realm} · ${event.file || '(no file)'}`
}

export function renderChromeTrace(events: Event[]): object {
  const pids = new Map<string, number>()
  const tids = new Map<string, number>()
  const out: TraceEvent[] = []

  function pidFor(key: string): number {
    if (!pids.has(key)) {
      pids.set(key, pids.size + 1)
      out.push({ ph: 'M', pid: pids.get(key), name: 'process_name', args: { name: key } })
    }
    return pids.get(key)!
  }

  function tidFor(pid: number, key: string): number {
    const cacheKey = `${pid}|${key}`
    if (!tids.has(cacheKey)) {
      tids.set(cacheKey, tids.size + 1)
      out.push({ ph: 'M', pid, tid: tids.get(cacheKey), name: 'thread_name', args: { name: key } })
    }
    return tids.get(cacheKey)!
  }

  for (const event of events) {
    const pid = pidFor(processKey(event))
    const tid = tidFor(pid, threadKey(event))
    const baseArgs = {
      test: event.test,
      suite: (event.suitePath ?? []).join(' > '),
      trace: event.traceId,
      span: event.spanId,
      ...(event.attrs ?? {}),
    }
    const base: Omit<TraceEvent, 'ph'> = { pid, tid, ts: Math.round(event.t * 1000), cat: event.kind, args: baseArgs }

    if (event.kind === 'span') {
      const name = event.name?.endsWith('run.test')
        ? `run.test ${event.test}`
        : (event.name ?? '').replace('vitest.test.runner.', '')
      out.push({
        ...base,
        ph: 'X',
        name,
        cat: `${event.realm}|${event.project ?? ''}|span`,
        dur: Math.max(1, Math.round((event.durationMs ?? 0) * 1000)),
        args: { ...baseArgs, status: event.status, error: event.error },
        cname: event.status === 'error' ? 'terrible' : undefined,
      })
    } else if (event.kind === 'log') {
      out.push({
        ...base,
        ph: 'i',
        s: 't',
        name: `${event.level}: ${(event.message ?? '').slice(0, 80)}`,
        args: { ...baseArgs, category: event.categoryPath, message: event.message },
      })
    } else if (event.kind === 'playwright') {
      out.push({ ...base, ph: 'i', s: 't', name: (event.message ?? '').slice(0, 80) })
    } else if (event.kind === 'verdict') {
      out.push({
        ...base,
        ph: 'i',
        s: 't',
        name: `${event.status} ${event.test}`,
        args: { ...baseArgs, failure: event.failure, durationMs: event.durationMs },
        cname: event.status === 'fail' ? 'terrible' : 'good',
      })
    } else if (event.kind === 'metric') {
      out.push({ ...base, ph: 'C', name: event.name, args: { value: event.value ?? event.sum } })
    }
  }

  return { traceEvents: out, displayTimeUnit: 'ms' }
}
