import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import type { TelemetryDefine } from './index.js'

export interface TelemetryOptions {
  /** Category root, default 'app'. */
  root?: string
  /** Output directory for every telemetry artifact, default 'out'. */
  outDir?: string
  /** OTLP/HTTP collector base URL, default 'http://localhost:4318'. */
  otlp?: string
  /** Start the built-in OTLP/HTTP receiver, default true. Set false against a real collector. */
  receiver?: boolean
  /** Shard tag, default process.env.VITEST_SHARD ?? process.env.LAB_SHARD ?? 'none'. */
  shard?: string
  /** debug.js namespaces bridged into LogTape, default `${root}:*`. */
  debugNamespaces?: string
  /** Node realm jsonl file sink per worker pid, default true. */
  fileSink?: boolean
}

const OPTIMIZE_DEPS = [
  '@logtape/logtape',
  '@logtape/otel',
  '@opentelemetry/api',
  '@opentelemetry/resources',
  '@opentelemetry/sdk-logs',
  '@opentelemetry/sdk-trace-web',
  '@opentelemetry/exporter-logs-otlp-http',
  '@opentelemetry/exporter-trace-otlp-http',
  'debug',
]

// Resolves a file next to this module by name, keeping the extension this module itself was
// loaded with: '.js' from dist/, '.ts' when vitest loads plugin.ts straight from src/.
function siblingPath(name: string): string {
  const extension = import.meta.url.endsWith('.ts') ? 'ts' : 'js'
  return fileURLToPath(new URL(`./${name}.${extension}`, import.meta.url))
}

export function telemetry(options: TelemetryOptions = {}): Plugin {
  const root = options.root ?? 'app'
  const define: TelemetryDefine = {
    root,
    rootDir: process.cwd(),
    outDir: options.outDir ?? 'out',
    otlp: options.otlp ?? 'http://localhost:4318',
    shard: options.shard ?? process.env.VITEST_SHARD ?? process.env.LAB_SHARD ?? 'none',
    debugNamespaces: options.debugNamespaces ?? `${root}:*`,
    fileSink: options.fileSink ?? true,
  }
  const receiver = options.receiver ?? true
  // `vitest --merge-reports` replays blob reports in the main process without running globalSetup,
  // so the receiver never starts there; any SDK the plugin enables would flush into a closed port.
  const merging = process.argv.includes('--merge-reports')

  return {
    name: 'vitest-telemetry',
    config() {
      // receiver.ts and otel.node.ts run outside the per-file vite transform pipeline
      // (globalSetup / the experimental openTelemetry main-process loader), so the
      // `define` below does not reach them: hand them the same JSON through the env.
      process.env.VITEST_TELEMETRY = JSON.stringify(define)
      return {
        define: { __TELEMETRY__: JSON.stringify(define) },
        optimizeDeps: { include: OPTIMIZE_DEPS },
        test: {
          setupFiles: [siblingPath('setup')],
          globalSetup: receiver && !merging ? [siblingPath('receiver')] : [],
          experimental: {
            openTelemetry: {
              enabled: !merging,
              sdkPath: siblingPath('otel.node'),
              browserSdkPath: siblingPath('otel.browser'),
            },
          },
        },
      }
    },
  }
}
