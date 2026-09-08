// out/otlp-*.jsonl + out/pw-debug.log + out/junit-merged.xml -> Event[], one row per span, log,
// metric point, playwright debug line, or junit verdict.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export type Kind = 'span' | 'log' | 'metric' | 'playwright' | 'verdict' | 'process'

export interface Event {
  t: number
  tRel: number
  iso: string
  kind: Kind
  realm: 'node' | 'browser' | 'playwright' | 'junit'
  service: string | null
  shard: string | null
  project: string | null
  suitePath: string[]
  file: string
  test: string | null
  testId: string | null
  traceId: string | null
  spanId: string | null
  parentSpanId: string | null
  // Resource `process.pid`, or null for events with no OS process behind them (browser page
  // resources, metrics, playwright driver lines, junit verdicts).
  pid: number | null
  // Nesting by time containment, assigned in assignNesting: id is spanId for spans and
  // `${kind}:${t}:${index}` for instants; parentId is the tightest containing event in the
  // same realm+file+test scope; detachedAt is the parent end when this event outlives it.
  id: string
  parentId: string | null
  detachedAt: number | null
  depth: number
  name?: string
  namespace?: string
  durationMs?: number
  status?: 'ok' | 'error' | 'pass' | 'fail' | 'skip'
  error?: string | null
  failure?: string | null
  level?: string
  category?: string[]
  categoryPath?: string
  message?: string
  value?: number | null
  count?: number | null
  sum?: number | null
  attrs: Record<string, unknown>
  attributedBy?: string
  // kind: 'process' rows only, one per resource that carried a pid.
  ppid?: number | null
  command?: string
  ancestry?: string[]
  spanCount?: number
}

interface OtlpAttrValue {
  stringValue?: string
  intValue?: number | string
  doubleValue?: number
  boolValue?: boolean
  arrayValue?: { values: OtlpAttrValue[] }
}
interface OtlpAttribute {
  key: string
  value: OtlpAttrValue
}
interface OtlpSpan {
  traceId: string
  spanId: string
  parentSpanId?: string
  name: string
  startTimeUnixNano: string
  endTimeUnixNano: string
  attributes?: OtlpAttribute[]
  status?: { code?: number }
  events?: { attributes?: OtlpAttribute[] }[]
}
interface OtlpLogRecord {
  timeUnixNano?: string
  observedTimeUnixNano?: string
  severityText?: string
  spanId?: string
  traceId?: string
  attributes?: OtlpAttribute[]
  body?: { stringValue?: string }
}
interface OtlpMetricPoint {
  timeUnixNano: string
  asInt?: number | string
  asDouble?: number
  count?: number
  sum?: number
  attributes?: OtlpAttribute[]
}
interface OtlpMetric {
  name: string
  sum?: { dataPoints: OtlpMetricPoint[] }
  gauge?: { dataPoints: OtlpMetricPoint[] }
  histogram?: { dataPoints: OtlpMetricPoint[] }
}
interface OtlpResource {
  attributes?: OtlpAttribute[]
}
interface OtlpTraceBatch {
  resourceSpans: { resource?: OtlpResource; scopeSpans: { spans: OtlpSpan[] }[] }[]
}
interface OtlpLogBatch {
  resourceLogs: { resource?: OtlpResource; scopeLogs: { logRecords: OtlpLogRecord[] }[] }[]
}
interface OtlpMetricBatch {
  resourceMetrics: { resource?: OtlpResource; scopeMetrics: { metrics: OtlpMetric[] }[] }[]
}

interface SpanRecord extends OtlpSpan {
  service: string | null
  shard: string | null
  pid: number | null
  ppid: number | null
  commandLine: string | null
  commandArgs: string[] | null
  ancestry: string[]
  a: Record<string, unknown>
}

// vitest's own internal instrumentation spans: not part of the tested code, dropped from the
// timeline.
const NOISE = /^vitest\.(module|config|coverage|runtime\.(environment|setup|coverage|global_env|snapshot|runner|traces)|browser\.tester\.command)/

// Unix nanoseconds arrive as decimal strings above 2^53; Number() on them loses sub-millisecond
// digits. Divide as BigInt to microseconds first, then to milliseconds as a double.
function nanosToMs(nanos: string | undefined): number {
  if (!nanos) return Number.NaN
  return Number(BigInt(nanos) / 1000n) / 1000
}

function readJsonLines(path: string): unknown[] {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

// Every shard writes its own otlp-<signal>[-<shard>].jsonl: read and concatenate all of them.
function readOtlpBatches(outDir: string, prefix: string): unknown[] {
  const files = existsSync(outDir) ? readdirSync(outDir) : []
  const matches = files.filter((file) => file.startsWith(prefix) && file.endsWith('.jsonl')).sort()
  return matches.flatMap((file) => readJsonLines(join(outDir, file)))
}

function attrValue(value: OtlpAttrValue): unknown {
  if (value.arrayValue) return value.arrayValue.values.map((entry) => attrValue(entry))
  if (value.stringValue !== undefined) return value.stringValue
  if (value.intValue !== undefined) return value.intValue
  if (value.doubleValue !== undefined) return value.doubleValue
  if (value.boolValue !== undefined) return value.boolValue
  return undefined
}

function attr(attributes: OtlpAttribute[] | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const entry of attributes ?? []) out[entry.key] = attrValue(entry.value)
  return out
}

// Resource attributes carry the shard under a root-specific key (`${root}.shard`); find it by
// suffix instead of hard-coding the root.
function shardOf(resource: Record<string, unknown>): string | null {
  const key = Object.keys(resource).find((k) => k.endsWith('.shard'))
  return key ? (resource[key] as string) : null
}

function realmOf(service: string | null): Event['realm'] {
  if (service?.includes('browser')) return 'browser'
  if (service === 'playwright') return 'playwright'
  if (service === 'junit') return 'junit'
  return 'node'
}

function pidOf(resource: Record<string, unknown>): number | null {
  const value = resource['process.pid']
  return typeof value === 'number' ? value : null
}

function flattenSpans(batches: unknown[]): SpanRecord[] {
  const spans: SpanRecord[] = []
  for (const batch of batches as OtlpTraceBatch[]) {
    for (const resourceSpans of batch.resourceSpans) {
      const resource = attr(resourceSpans.resource?.attributes)
      const service = (resource['service.name'] as string) ?? null
      const shard = shardOf(resource)
      const pid = pidOf(resource)
      const ppid = typeof resource['process.parent_pid'] === 'number' ? (resource['process.parent_pid'] as number) : null
      const commandLine = typeof resource['process.command_line'] === 'string' ? (resource['process.command_line'] as string) : null
      const commandArgs = Array.isArray(resource['process.command_args']) ? (resource['process.command_args'] as string[]) : null
      const ancestry = Array.isArray(resource['process.ancestry']) ? (resource['process.ancestry'] as string[]) : []
      for (const scopeSpans of resourceSpans.scopeSpans) {
        for (const span of scopeSpans.spans) {
          spans.push({ ...span, service, shard, pid, ppid, commandLine, commandArgs, ancestry, a: attr(span.attributes) })
        }
      }
    }
  }
  return spans
}

function ancestorsOf(span: SpanRecord, byId: Map<string, SpanRecord>): SpanRecord[] {
  const chain: SpanRecord[] = []
  let current: SpanRecord | undefined = span
  for (let i = 0; i < 60 && current; i++) {
    chain.push(current)
    current = current.parentSpanId ? byId.get(current.parentSpanId) : undefined
  }
  return chain
}

function testOf(span: SpanRecord, byId: Map<string, SpanRecord>): SpanRecord | undefined {
  return ancestorsOf(span, byId).find((ancestor) => ancestor.a['vitest.test.name'])
}

function fileOf(span: SpanRecord, byId: Map<string, SpanRecord>, cwd: string): string {
  const found = ancestorsOf(span, byId).find((ancestor) => ancestor.a['code.file.path'])
  if (!found) return ''
  return (found.a['code.file.path'] as string).replace(cwd + '/', '')
}

function projectOf(span: SpanRecord, byId: Map<string, SpanRecord>): string | null {
  const found = ancestorsOf(span, byId).find((ancestor) => ancestor.a['vitest.project'])
  return (found?.a['vitest.project'] as string) ?? null
}

function suitesOf(span: SpanRecord, byId: Map<string, SpanRecord>): string[] {
  return ancestorsOf(span, byId)
    .filter((ancestor) => ancestor.name.endsWith('run.suite'))
    .map((ancestor) => ancestor.a['vitest.suite.name'] as string)
    .reverse()
}

function depthOf(span: SpanRecord, byId: Map<string, SpanRecord>): number {
  return ancestorsOf(span, byId).filter((ancestor) => !NOISE.test(ancestor.name)).length - 1
}

function spanEvents(spans: SpanRecord[], byId: Map<string, SpanRecord>, cwd: string): Event[] {
  const events: Event[] = []
  for (const span of spans) {
    if (NOISE.test(span.name)) continue
    const test = testOf(span, byId)
    const exceptionMessages = (span.events ?? []).flatMap((entry) => {
      const message = attr(entry.attributes)['exception.message']
      return message ? [message as string] : []
    })
    const attrs = Object.fromEntries(
      Object.entries(span.a).filter(([key]) => !/^(vitest\.test\.(name|id)|code\.file\.path)$/.test(key)),
    )
    events.push({
      t: nanosToMs(span.startTimeUnixNano),
      tRel: 0,
      iso: '',
      kind: 'span',
      realm: realmOf(span.service),
      service: span.service,
      shard: span.shard,
      project: projectOf(span, byId),
      suitePath: suitesOf(span, byId),
      file: fileOf(span, byId, cwd),
      test: (test?.a['vitest.test.name'] as string) ?? null,
      testId: (test?.a['vitest.test.id'] as string) ?? null,
      traceId: span.traceId,
      spanId: span.spanId,
      parentSpanId: span.parentSpanId ?? null,
      pid: span.pid,
      depth: depthOf(span, byId),
      id: '',
      parentId: null,
      detachedAt: null,
      name: span.name,
      durationMs: Number((nanosToMs(span.endTimeUnixNano) - nanosToMs(span.startTimeUnixNano)).toFixed(3)),
      status: span.status?.code === 2 ? 'error' : 'ok',
      error: exceptionMessages[0] ?? null,
      attrs,
    })
  }
  return events
}

function logEvents(batches: unknown[], byId: Map<string, SpanRecord>, cwd: string): Event[] {
  const events: Event[] = []
  for (const batch of batches as OtlpLogBatch[]) {
    for (const resourceLogs of batch.resourceLogs) {
      const resource = attr(resourceLogs.resource?.attributes)
      const service = (resource['service.name'] as string) ?? null
      const shard = shardOf(resource)
      const pid = pidOf(resource)
      for (const scopeLogs of resourceLogs.scopeLogs) {
        for (const record of scopeLogs.logRecords) {
          const recordAttrs = attr(record.attributes)
          const parent = record.spanId ? byId.get(record.spanId) : undefined
          const test = parent ? testOf(parent, byId) : undefined
          const category = (recordAttrs.category as string[]) ?? []
          events.push({
            t: nanosToMs(record.timeUnixNano ?? record.observedTimeUnixNano),
            tRel: 0,
            iso: '',
            kind: 'log',
            realm: realmOf(service),
            service,
            shard,
            project: parent ? projectOf(parent, byId) : null,
            suitePath: parent ? suitesOf(parent, byId) : [],
            file: parent ? fileOf(parent, byId, cwd) : '',
            test: (test?.a['vitest.test.name'] as string) ?? null,
            testId: (test?.a['vitest.test.id'] as string) ?? null,
            traceId: record.traceId || null,
            spanId: record.spanId || null,
            parentSpanId: null,
            pid,
            depth: parent ? depthOf(parent, byId) + 1 : 0,
            id: '',
            parentId: null,
            detachedAt: null,
            level: record.severityText,
            category,
            categoryPath: category.join('/'),
            message: record.body?.stringValue ?? '',
            attrs: Object.fromEntries(Object.entries(recordAttrs).filter(([key]) => key !== 'category')),
          })
        }
      }
    }
  }
  return events
}

function metricEvents(batches: unknown[]): Event[] {
  const events: Event[] = []
  for (const batch of batches as OtlpMetricBatch[]) {
    for (const resourceMetrics of batch.resourceMetrics) {
      const pid = pidOf(attr(resourceMetrics.resource?.attributes))
      for (const scopeMetrics of resourceMetrics.scopeMetrics) {
        for (const metric of scopeMetrics.metrics) {
          const points = metric.sum?.dataPoints ?? metric.gauge?.dataPoints ?? metric.histogram?.dataPoints ?? []
          for (const point of points) {
            const pointAttrs = attr(point.attributes)
            events.push({
              t: nanosToMs(point.timeUnixNano),
              tRel: 0,
              iso: '',
              kind: 'metric',
              realm: 'node',
              service: 'node',
              shard: null,
              project: null,
              suitePath: [],
              file: (pointAttrs.file as string) ?? '',
              test: null,
              testId: null,
              traceId: null,
              spanId: null,
              parentSpanId: null,
              pid,
              depth: 0,
              id: '',
              parentId: null,
              detachedAt: null,
              name: metric.name,
              value: (point.asInt as number) ?? point.asDouble ?? null,
              count: point.count ?? null,
              sum: point.sum ?? null,
              attrs: pointAttrs,
            })
          }
        }
      }
    }
  }
  return events
}

function playwrightEvents(outDir: string): Event[] {
  const path = join(outDir, 'pw-debug.log')
  if (!existsSync(path)) return []
  const events: Event[] = []
  for (const line of readFileSync(path, 'utf8').split('\n').filter(Boolean)) {
    const match = line.match(/^(\S+) (pw:\S+) (.*)$/)
    if (!match) continue
    events.push({
      t: Date.parse(match[1]),
      tRel: 0,
      iso: '',
      kind: 'playwright',
      realm: 'playwright',
      service: 'playwright',
      shard: null,
      project: null,
      suitePath: [],
      file: '',
      test: null,
      testId: null,
      traceId: null,
      spanId: null,
      parentSpanId: null,
      pid: null,
      depth: 0,
      id: '',
      parentId: null,
      detachedAt: null,
      namespace: match[2],
      message: match[3],
      attrs: {},
    })
  }
  return events
}

function unescapeXmlAttr(value: string): string {
  return value.replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
}

function verdictEvents(outDir: string): Event[] {
  const path = join(outDir, 'junit-merged.xml')
  if (!existsSync(path)) return []
  const xml = readFileSync(path, 'utf8')
  const events: Event[] = []
  for (const suiteChunk of xml.split('<testsuite ').slice(1)) {
    const file = suiteChunk.match(/name="([^"]+)"/)?.[1]
    let clock = Date.parse(suiteChunk.match(/timestamp="([^"]+)"/)?.[1] ?? '0')
    for (const caseChunk of suiteChunk.split('<testcase ').slice(1)) {
      const name = caseChunk.match(/\sname="([^"]+)"/)?.[1]
      const className = caseChunk.match(/classname="([^"]+)"/)?.[1]
      const durationSeconds = Number(caseChunk.match(/time="([^"]+)"/)?.[1] ?? 0)
      const durationMs = durationSeconds * 1000
      clock += durationMs
      const suitePath = name ? unescapeXmlAttr(name).split(' > ').slice(0, -1) : []
      const testName = name ? unescapeXmlAttr(name).split(' > ').pop() || null : null
      events.push({
        t: clock,
        tRel: 0,
        iso: '',
        kind: 'verdict',
        realm: 'junit',
        service: 'junit',
        shard: null,
        project: null,
        suitePath,
        file: (className ?? file ?? '').replace(/^.*?\|/, '').trim(),
        test: testName,
        testId: null,
        traceId: null,
        spanId: null,
        parentSpanId: null,
        pid: null,
        depth: 0,
        id: '',
        parentId: null,
        detachedAt: null,
        status: caseChunk.includes('<failure') ? 'fail' : 'pass',
        durationMs: Number(durationMs.toFixed(0)),
        failure: caseChunk.match(/<failure message="([^"]*)"/)?.[1] ?? null,
        attrs: {},
      })
    }
  }
  return events
}

interface TestWindow {
  realm: Event['realm']
  file: string
  test: string | null
  testId: string | null
  s: number
  e: number
  depth: number
  shard: string | null
  project: string | null
  suitePath: string[]
}

// Browser realm loses async context after the first await: spans and logs without a direct
// `vitest.test.*` ancestor get attributed to the enclosing `run.test` span by time window.
function attributeOrphans(events: Event[]): void {
  const suiteSpans = events.filter((e) => e.kind === 'span' && e.name?.endsWith('run.suite'))
  for (const event of events) {
    if (event.kind === 'span' && event.name?.endsWith('run.test') && !event.suitePath.length) {
      event.suitePath = suiteSpans
        .filter(
          (candidate) =>
            candidate.realm === event.realm &&
            candidate.file === event.file &&
            candidate.t <= event.t &&
            candidate.t + (candidate.durationMs ?? 0) >= event.t + (event.durationMs ?? 0),
        )
        .sort((a, b) => a.t - b.t)
        .map((candidate) => candidate.attrs['vitest.suite.name'] as string)
    }
  }

  const windows: TestWindow[] = events
    .filter((e) => e.kind === 'span' && e.name?.endsWith('run.test'))
    .map((e) => ({
      realm: e.realm,
      file: e.file,
      test: e.test,
      testId: e.testId,
      s: e.t,
      e: e.t + (e.durationMs ?? 0),
      depth: e.depth,
      shard: e.shard,
      project: e.project,
      suitePath: e.suitePath,
    }))

  for (const event of events) {
    if (event.test || event.kind === 'verdict' || event.kind === 'metric' || event.kind === 'playwright') continue
    // node runs files in parallel workers: require the file to match there. Browser runs files
    // sequentially in one page.
    const window = windows.find(
      (w) =>
        w.realm === event.realm &&
        (event.file ? w.file === event.file : event.realm === 'browser') &&
        event.t >= w.s - 1 &&
        event.t <= w.e + 1,
    )
    if (!window) continue
    event.test = window.test
    event.testId = window.testId
    event.file ||= window.file
    event.attributedBy = 'time-window'
    event.shard ??= window.shard
    event.project ??= window.project
    if (!event.suitePath?.length) event.suitePath = window.suitePath
    if (event.kind === 'span' && event.parentSpanId == null) event.depth = window.depth + 1
  }

  for (const event of events) {
    if (!event.test) continue
    const window = windows.find((w) => w.test === event.test && w.file === event.file && w.realm === event.realm)
    if (!window) continue
    event.project ??= window.project
    event.shard ??= window.shard
    if (!event.suitePath?.length) event.suitePath = window.suitePath
  }
}

// One pass per realm+file+test scope over events sorted by start. Span start times arrive at
// whole-millisecond precision while durations carry sub-millisecond digits, so every comparison
// runs on floored milliseconds. An open interval closes when `floor(end) <= floor(next.start)`,
// so a boundary tie makes a sibling, never a detach. Instants never become parents.
// depth = open intervals at start. parentId = the open interval with the smallest end.
// detachedAt = parent end when the event ends in a later millisecond than its parent.
function assignNesting(events: Event[]): void {
  const usedIds = new Set<string>()
  events.forEach((event, index) => {
    let id = event.kind === 'span' && event.spanId ? event.spanId : `${event.kind}:${event.t}:${index}`
    while (usedIds.has(id)) id = `${id}:${index}`
    usedIds.add(id)
    event.id = id
  })

  const groups = new Map<string, Event[]>()
  for (const event of events) {
    const key = `${event.realm}\u0000${event.file}\u0000${event.test ?? ''}`
    const group = groups.get(key)
    if (group) group.push(event)
    else groups.set(key, [event])
  }

  // Containment compares raw sub-millisecond times: a 1.266 ms run.test span must still contain the
  // callback that starts 1 ms in. Detach rounds to whole ms so clock jitter never flags an overrun.
  const endOf = (event: Event) => event.t + (event.durationMs ?? 0)
  const ms = (time: number) => Math.floor(time)
  for (const group of groups.values()) {
    group.sort((a, b) => a.t - b.t || (b.durationMs ?? 0) - (a.durationMs ?? 0))
    let open: Event[] = []
    for (const event of group) {
      open = open.filter((candidate) => endOf(candidate) > event.t)
      let parent: Event | null = null
      for (const candidate of open) {
        if (!parent || endOf(candidate) < endOf(parent)) parent = candidate
      }
      event.depth = open.length
      event.parentId = parent ? parent.id : null
      event.detachedAt = parent && ms(endOf(event)) > ms(endOf(parent)) ? endOf(parent) : null
      if ((event.durationMs ?? 0) > 0) open.push(event)
    }
  }
}

function mostCommonProject(projects: (string | null)[]): string | null {
  const counts = new Map<string, number>()
  for (const project of projects) {
    if (!project) continue
    counts.set(project, (counts.get(project) ?? 0) + 1)
  }
  let best: string | null = null
  let bestCount = 0
  for (const [project, count] of counts) {
    if (count > bestCount) {
      best = project
      bestCount = count
    }
  }
  return best
}

// One row per resource that carried a `process.pid`: pid identifies the resource, since each
// NodeSDK instance (one per vitest worker) sets its own pid/ppid/ancestry once at startup.
function buildProcessEvents(spans: SpanRecord[], spanEventsById: Map<string, Event>): Event[] {
  const groups = new Map<number, SpanRecord[]>()
  for (const span of spans) {
    if (span.pid == null) continue
    const group = groups.get(span.pid)
    if (group) group.push(span)
    else groups.set(span.pid, [span])
  }

  const rows: Event[] = []
  for (const [pid, group] of groups) {
    const first = group[0]
    const starts = group.map((span) => nanosToMs(span.startTimeUnixNano))
    const ends = group.map((span) => nanosToMs(span.endTimeUnixNano))
    const t = Math.min(...starts)
    const projects = group.map((span) => spanEventsById.get(span.spanId)?.project ?? null)
    rows.push({
      t,
      tRel: 0,
      iso: '',
      kind: 'process',
      realm: realmOf(first.service),
      service: first.service,
      shard: first.shard,
      project: mostCommonProject(projects),
      suitePath: [],
      file: '',
      test: null,
      testId: null,
      traceId: null,
      spanId: null,
      parentSpanId: null,
      pid,
      depth: 0,
      id: `process:${pid}`,
      parentId: null,
      detachedAt: null,
      ppid: first.ppid,
      command: first.commandLine ?? (first.commandArgs ? first.commandArgs.join(' ') : ''),
      ancestry: first.ancestry,
      spanCount: group.length,
      durationMs: Number((Math.max(...ends) - t).toFixed(3)),
      attrs: {},
    })
  }
  return rows
}

export function buildTimeline(outDir: string): Event[] {
  const cwd = process.cwd()
  const spans = flattenSpans(readOtlpBatches(outDir, 'otlp-traces'))
  const byId = new Map(spans.map((span) => [span.spanId, span]))

  let events: Event[] = [
    ...spanEvents(spans, byId, cwd),
    ...logEvents(readOtlpBatches(outDir, 'otlp-logs'), byId, cwd),
    ...metricEvents(readOtlpBatches(outDir, 'otlp-metrics')),
    ...playwrightEvents(outDir),
    ...verdictEvents(outDir),
  ]

  attributeOrphans(events)

  events = events.filter((event) => Number.isFinite(event.t))
  events.sort((a, b) => a.t - b.t)
  assignNesting(events)

  const spanEventsById = new Map(
    events.filter((event): event is Event & { spanId: string } => event.kind === 'span' && event.spanId != null).map((event) => [event.spanId, event]),
  )
  events = [...events, ...buildProcessEvents(spans, spanEventsById)].sort((a, b) => a.t - b.t)

  const t0 = events[0]?.t ?? 0
  for (const event of events) {
    event.tRel = Number(((event.t - t0) / 1000).toFixed(3))
    event.iso = new Date(event.t).toISOString()
  }
  return events
}
