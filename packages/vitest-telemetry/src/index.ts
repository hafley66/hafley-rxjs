import { getLogger, type Logger as LogTapeLogger, type LogRecord } from '@logtape/logtape'
import debugModule from 'debug'

// JSON shape written by plugin.ts to the vite `__TELEMETRY__` define and to
// process.env.VITEST_TELEMETRY (read by code that runs outside the per-file vite
// transform pipeline: receiver.ts and otel.node.ts).
export interface TelemetryDefine {
  root: string
  rootDir: string
  outDir: string
  otlp: string
  shard: string
  debugNamespaces: string
  fileSink: boolean
}

declare const __TELEMETRY__: TelemetryDefine

/** Logger(import.meta.url): category = [root, ...repo-relative path segments]. */
export function Logger(importMetaUrl: string): LogTapeLogger {
  const path = new URL(importMetaUrl).pathname
    .replace(/^\/@fs/, '')
    .replace(__TELEMETRY__.rootDir, '')
    .split('?')[0]
  return getLogger([__TELEMETRY__.root, ...path.split('/').filter(Boolean)])
}

// Route debug.js output into LogTape. Works in node and browser (debug uses console.debug
// in browser otherwise).
export function bridgeDebugToLogTape(namespaces: string): void {
  // debug.enable() on node writes back to process.env.DEBUG: keep what the shell set
  // (e.g. pw:api for playwright's bundled debug).
  const prior = typeof process !== 'undefined' ? process.env.DEBUG : undefined
  debugModule.enable([prior, namespaces].filter(Boolean).join(','))
  debugModule.log = function (this: { namespace?: string }, ...args: unknown[]) {
    const namespace = (this && this.namespace) || 'debug'
    getLogger(['debug', ...namespace.split(':')]).debug(args.map(String).join(' '))
  }
}

// Memory sink target, populated by setup.ts. Lets tests assert on logs directly.
export const captured: LogRecord[] = []
