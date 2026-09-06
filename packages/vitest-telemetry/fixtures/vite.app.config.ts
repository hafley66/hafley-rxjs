import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// Standalone vite build for the e2e harness (raw playwright, no vitest project wrapper): this
// never goes through the telemetry() plugin's config hook, so counter.ts's Logger() call needs
// its own __TELEMETRY__ define here.
const telemetryDefine = {
  root: 'lab',
  rootDir: process.cwd(),
  outDir: 'out',
  otlp: 'http://localhost:14318',
  shard: 'none',
  debugNamespaces: 'lab:*',
  fileSink: true,
}

export default defineConfig({
  root: resolve(import.meta.dirname, 'src'),
  define: { __TELEMETRY__: JSON.stringify(telemetryDefine) },
  build: {
    outDir: '../out/dist',
    emptyOutDir: true,
    rollupOptions: { input: resolve(import.meta.dirname, 'src/app.html') },
  },
  logLevel: 'silent',
})
