#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs'
import { spawn, execFileSync } from 'node:child_process'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { trace, context, SpanStatusCode, defaultTextMapGetter, defaultTextMapSetter, type Context } from '@opentelemetry/api'
import { tracing, core } from '@opentelemetry/sdk-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { buildTimeline, renderChromeTrace, renderReport } from './report/index.js'
import type { TelemetryDefine } from './index.js'

// Matches the telemetry() plugin's own default (plugin.ts): the wrapper has no vite config to
// read, so this is the fallback when neither --otlp nor VITEST_TELEMETRY supplies one.
const DEFAULT_OTLP = 'http://localhost:4318'
// Matches the plugin's outDir default: the wrapper has no vite config to read either.
const DEFAULT_OUT = 'out'

function usage(): never {
  console.error('usage: vitest-telemetry <report|trace> [--out out] [--open]')
  console.error('       vitest-telemetry run [--otlp URL] -- <command...>')
  process.exit(1)
}

function parseOutOpen(args: string[]): { out: string; open: boolean } {
  const { values } = parseArgs({
    args,
    options: {
      out: { type: 'string', default: 'out' },
      open: { type: 'boolean', default: false },
    },
  })
  return { out: values.out as string, open: values.open as boolean }
}

function writeTimeline(out: string): ReturnType<typeof buildTimeline> {
  const events = buildTimeline(out)
  mkdirSync(out, { recursive: true })
  writeFileSync(`${out}/timeline.jsonl`, events.map((event) => JSON.stringify(event)).join('\n') + '\n')
  return events
}

function runReport(args: string[]): void {
  const { out, open } = parseOutOpen(args)
  const events = writeTimeline(out)
  const html = renderReport(events)
  writeFileSync(`${out}/report.html`, html)
  console.log(`wrote ${out}/timeline.jsonl (${events.length} events) and ${out}/report.html`)
  if (open) spawn('open', [`${out}/report.html`], { stdio: 'ignore', detached: true }).unref()
}

function runTrace(args: string[]): void {
  const { out } = parseOutOpen(args)
  const events = writeTimeline(out)
  const chromeTrace = renderChromeTrace(events)
  writeFileSync(`${out}/trace.json`, JSON.stringify(chromeTrace))
  console.log(`wrote ${out}/trace.json`)
}

// Walks parent pids with `ps`, one call per hop, from startPid up to pid 1 or maxHops. Each
// chain entry is the raw `ps -o pid=,ppid=,command=` line: "<pid> <ppid> <command>". A missing
// `ps` binary (ENOENT) or any lookup failure yields an empty array rather than a partial chain.
// Duplicated from otel.node.ts: that module throws at import time when VITEST_TELEMETRY is
// unset, which is the normal state for this wrapper, so it cannot be imported here.
function processAncestry(startPid: number, maxHops = 12): string[] {
  try {
    const chain: string[] = []
    let pid = startPid
    for (let hop = 0; hop < maxHops && pid > 1; hop++) {
      const line = execFileSync('ps', ['-o', 'pid=,ppid=,command=', '-p', String(pid)], { encoding: 'utf8' }).trim()
      if (!line) break
      chain.push(line)
      const ppid = Number(line.split(/\s+/)[1])
      if (!Number.isFinite(ppid) || ppid <= 1) break
      pid = ppid
    }
    return chain
  } catch {
    return []
  }
}

function readTelemetryDefineQuiet(): TelemetryDefine | null {
  const raw = process.env.VITEST_TELEMETRY
  if (!raw) return null
  try {
    return JSON.parse(raw) as TelemetryDefine
  } catch {
    return null
  }
}

function parseRunArgs(args: string[]): { otlp: string; command: string[] } {
  const dashIndex = args.indexOf('--')
  if (dashIndex === -1 || dashIndex === args.length - 1) usage()
  const { values } = parseArgs({ args: args.slice(0, dashIndex), options: { otlp: { type: 'string' } } })
  const command = args.slice(dashIndex + 1)
  const define = readTelemetryDefineQuiet()
  const otlp = (values.otlp as string | undefined) ?? define?.otlp ?? DEFAULT_OTLP
  return { otlp, command }
}

// A prior `run` in the same process tree (the merge run wrapped alongside both shards under one
// outer `sh -c`) already set TRACEPARENT: extract it as the parent so every nested `run` and
// the vitest.start spans it spawns land under one trace instead of minting a fresh root each time.
function extractParentContext(): Context {
  if (!process.env.TRACEPARENT) return context.active()
  const propagator = new core.W3CTraceContextPropagator()
  const carrier: Record<string, string> = { traceparent: process.env.TRACEPARENT }
  if (process.env.TRACESTATE) carrier.tracestate = process.env.TRACESTATE
  return propagator.extract(context.active(), carrier, defaultTextMapGetter)
}

// The children (each a separate `vitest run` process) own the OTLP receiver only for their own
// lifetime: receiver.ts's globalSetup binds `${otlp}`'s port and the socket dies with that
// process. By the time this wrapper's own span ends (after the last child exits), no receiver
// is left listening, so the CLI span's own export would hit an empty port. Bind a throwaway
// receiver for that single export, on the same port, only in the gap after the last child's
// receiver has already released it and before this process exits.
function withTempReceiver<T>(otlpUrl: string, outDir: string, run: () => Promise<T>): Promise<T> {
  const port = Number(new URL(otlpUrl).port) || 4318
  mkdirSync(outDir, { recursive: true })
  const handleRequest = (req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8')
      appendFileSync(`${outDir}/otlp-traces-cli.jsonl`, body.replace(/\n/g, ' ') + '\n')
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end('{}')
    })
  }
  return new Promise<T>((resolve, reject) => {
    const server = createServer(handleRequest)
    server.on('error', reject)
    server.listen(port, () => {
      run()
        .then(resolve, reject)
        .finally(() => server.close())
    })
  })
}

async function runCliRun(args: string[]): Promise<void> {
  const { otlp, command } = parseRunArgs(args)
  if (!command.length) usage()

  // BatchSpanProcessor, not SimpleSpanProcessor: its forceFlush() actually waits for the
  // in-flight HTTP export to finish. SimpleSpanProcessor fires the export on span.end() without
  // giving forceFlush anything to wait on, so process.exit() below would race the POST.
  const exporter = new OTLPTraceExporter({ url: `${otlp}/v1/traces` })
  const provider = new tracing.BasicTracerProvider({ spanProcessors: [new tracing.BatchSpanProcessor(exporter)] })
  const tracer = provider.getTracer('vitest-telemetry-cli')
  const parentContext = extractParentContext()

  const span = tracer.startSpan(
    `cli ${command.join(' ')}`,
    {
      attributes: {
        'process.pid': process.pid,
        'process.command_line': process.argv.join(' '),
        'process.ancestry': processAncestry(process.ppid),
      },
    },
    parentContext,
  )

  // vitest reads TRACEPARENT/TRACESTATE straight off process.env (Traces#getContextFromEnv in
  // vitest/dist/chunks/traces.*.js) when it starts its own `vitest.start` root span: setting
  // them here before spawn nests that span under this one via plain env inheritance.
  const carrier: Record<string, string> = {}
  new core.W3CTraceContextPropagator().inject(trace.setSpan(parentContext, span), carrier, defaultTextMapSetter)

  const exitCode = await new Promise<number>((resolve) => {
    const child = spawn(command[0], command.slice(1), {
      stdio: 'inherit',
      env: {
        ...process.env,
        TRACEPARENT: carrier.traceparent,
        ...(carrier.tracestate ? { TRACESTATE: carrier.tracestate } : {}),
      },
    })
    child.on('exit', (code) => resolve(code ?? 1))
  })

  span.setAttribute('process.exit_code', exitCode)
  if (exitCode !== 0) span.setStatus({ code: SpanStatusCode.ERROR })
  span.end()

  await withTempReceiver(otlp, DEFAULT_OUT, () => provider.forceFlush())
  process.exit(exitCode)
}

const [command, ...rest] = process.argv.slice(2)
if (command === 'report') runReport(rest)
else if (command === 'trace') runTrace(rest)
else if (command === 'run')
  runCliRun(rest).catch((error: unknown) => {
    console.error(error)
    process.exit(1)
  })
else usage()
