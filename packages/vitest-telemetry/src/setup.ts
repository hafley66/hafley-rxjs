// Realm-detecting setupFile. The telemetry() plugin points every project at this one file;
// vitest runs it once per test file. With `isolate: false` a worker keeps LogTape's global state
// across files, so every configure() carries `reset: true` (the previous file's sinks were
// disposed by its afterAll anyway).
import { configure, dispose, getLogger, jsonLinesFormatter, type Config } from '@logtape/logtape'
import { getConsoleSink } from '@logtape/logtape'
import { getOpenTelemetrySink } from '@logtape/otel'
// @logtape/otel loads its exporter via import(variable), which Vite cannot rewrite in the
// browser bundle. Build the LoggerProvider statically so the same sink works in node and page.
import { LoggerProvider, SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { metrics } from '@opentelemetry/api'
import { afterAll, afterEach, beforeEach } from 'vitest'
import { bridgeDebugToLogTape, captured, type TelemetryDefine } from './index.js'

declare const __TELEMETRY__: TelemetryDefine

const cfg = __TELEMETRY__
const realm = typeof window === 'undefined' ? 'node' : 'browser'

const loggerProvider = new LoggerProvider({
  resource: resourceFromAttributes({
    'service.name': `${cfg.root}-logs-${realm}`,
    [`${cfg.root}.shard`]: cfg.shard,
  }),
  processors: [new SimpleLogRecordProcessor({ exporter: new OTLPLogExporter({ url: `${cfg.otlp}/v1/logs` }) })],
})

function baseConfig(): Config<string, string> {
  return {
    sinks: {
      console: getConsoleSink(),
      otel: getOpenTelemetrySink({ loggerProvider }),
      memory: (record) => {
        captured.push(record)
      },
    },
    loggers: [
      { category: cfg.root, lowestLevel: 'debug', sinks: ['console', 'otel', 'memory'] },
      { category: 'debug', lowestLevel: 'debug', sinks: ['console', 'otel', 'memory'] },
      { category: ['logtape', 'meta'], lowestLevel: 'warning', sinks: ['console'] },
    ],
  }
}

function installLifecycle(): void {
  bridgeDebugToLogTape(cfg.debugNamespaces)
  const meter = metrics.getMeter(cfg.root)
  const testsRun = meter.createCounter(`${cfg.root}.tests.run`)
  const testDuration = meter.createHistogram(`${cfg.root}.test.duration_ms`)
  const lifecycleLog = getLogger([cfg.root, 'lifecycle'])
  let start = 0
  beforeEach(({ task }) => {
    start = performance.now()
    lifecycleLog.debug('start {id} {name}', { id: task.id, name: task.name })
  })
  afterEach(({ task }) => {
    const ms = performance.now() - start
    testsRun.add(1, { file: task.file.name })
    testDuration.record(ms, { file: task.file.name })
    lifecycleLog.debug('end {id} {name} {ms}ms', { id: task.id, name: task.name, ms: Math.round(ms) })
  })
}

if (realm === 'node') {
  const { getStreamFileSink } = await import('@logtape/file')
  const { AsyncLocalStorage } = await import('node:async_hooks')
  const base = baseConfig()
  const sinks = cfg.fileSink
    ? { ...base.sinks, file: getStreamFileSink(`${cfg.outDir}/logs-node-${process.pid}.jsonl`, { formatter: jsonLinesFormatter }) }
    : base.sinks
  const loggers = cfg.fileSink
    ? base.loggers.map((logger) =>
        logger.category === cfg.root || logger.category === 'debug'
          ? { ...logger, sinks: [...(logger.sinks ?? []), 'file'] }
          : logger,
      )
    : base.loggers
  await configure({ ...base, sinks, loggers, contextLocalStorage: new AsyncLocalStorage(), reset: true })
} else {
  await configure({ ...baseConfig(), reset: true })
}

installLifecycle()

// flush otel + file sinks before the worker or page is torn down
afterAll(async () => {
  await dispose()
})
