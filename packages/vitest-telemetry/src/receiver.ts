// globalSetup: OTLP/HTTP JSON receiver. Appends every request body to
// <outDir>/otlp-<signal>.jsonl (or <outDir>/otlp-<signal>-<shard>.jsonl when sharded, so
// concurrent CI machines each writing their own out/ do not clobber each other after
// download-artifact merge-multiple concatenation).
// globalSetup runs in the vitest main process, outside the per-file vite transform pipeline:
// no `__TELEMETRY__` define here either, read process.env.VITEST_TELEMETRY.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { appendFileSync, mkdirSync } from 'node:fs'
import type { TelemetryDefine } from './index.js'

function readTelemetryEnv(): TelemetryDefine {
  const raw = process.env.VITEST_TELEMETRY
  if (!raw) throw new Error('vitest-telemetry: process.env.VITEST_TELEMETRY is unset; is the telemetry() plugin installed?')
  return JSON.parse(raw) as TelemetryDefine
}

function handleRequest(cfg: TelemetryDefine, suffix: string, counts: Record<string, number>) {
  return (req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }
    const signal = (req.url ?? '').replace('/v1/', '')
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8')
      appendFileSync(`${cfg.outDir}/otlp-${signal}${suffix}.jsonl`, body.replace(/\n/g, ' ') + '\n')
      counts[signal] = (counts[signal] ?? 0) + 1
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end('{}')
    })
  }
}

export default function receiver(): () => void {
  // globalSetup runs once per project in the same main process: keep one server.
  const g = globalThis as typeof globalThis & { __vitestTelemetryReceiver?: boolean }
  if (g.__vitestTelemetryReceiver) return () => {}
  g.__vitestTelemetryReceiver = true

  const cfg = readTelemetryEnv()
  mkdirSync(cfg.outDir, { recursive: true })
  const suffix = cfg.shard === 'none' ? '' : `-${cfg.shard}`
  const counts: Record<string, number> = {}
  const server = createServer(handleRequest(cfg, suffix, counts))
  const port = Number(new URL(cfg.otlp).port) || 4318
  server.listen(port)
  // SDK shutdown flushes after globalSetup teardown: do not close, let process exit drop it.
  server.unref()
  return () => {
    console.log('[vitest-telemetry] receiver batches', counts)
  }
}
