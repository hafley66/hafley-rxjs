// Loaded by vitest's experimental.openTelemetry sdkPath, in the main process, before every
// test file. This runs outside the per-file vite transform pipeline, so the `__TELEMETRY__`
// define does not exist here: read process.env.VITEST_TELEMETRY instead (written by the
// plugin's config hook).
import { execFileSync } from 'node:child_process'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { HostMetrics } from '@opentelemetry/host-metrics'
import type { TelemetryDefine } from './index.js'

function readTelemetryEnv(): TelemetryDefine {
  const raw = process.env.VITEST_TELEMETRY
  if (!raw) throw new Error('vitest-telemetry: process.env.VITEST_TELEMETRY is unset; is the telemetry() plugin installed?')
  return JSON.parse(raw) as TelemetryDefine
}

// Walks parent pids with `ps`, one call per hop, from startPid up to pid 1 or maxHops. Each
// chain entry is the raw `ps -o pid=,ppid=,command=` line: "<pid> <ppid> <command>". A missing
// `ps` binary (ENOENT) or any lookup failure yields an empty array rather than a partial chain.
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

const cfg = readTelemetryEnv()

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    'service.name': `${cfg.root}-node`,
    [`${cfg.root}.pid`]: process.pid,
    [`${cfg.root}.shard`]: cfg.shard,
    'process.pid': process.pid,
    'process.parent_pid': process.ppid,
    'process.command_line': process.argv.join(' '),
    'process.ancestry': processAncestry(process.ppid),
  }),
  traceExporter: new OTLPTraceExporter({ url: `${cfg.otlp}/v1/traces` }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({ url: `${cfg.otlp}/v1/metrics` }),
    exportIntervalMillis: 500,
  }),
})
sdk.start()
// Per-process cpu/memory gauges (process.cpu.utilization, process.memory.usage) plus host-wide
// system.cpu/system.memory, sampled on the same 500 ms reader; one series per worker pid.
new HostMetrics({
  name: `${cfg.root}-host`,
  metricGroups: ['process.cpu', 'process.memory', 'system.cpu', 'system.memory'],
}).start()
export default sdk
