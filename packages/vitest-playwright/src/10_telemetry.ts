// pkg:telemetry. tel: owns sinks and the report; this file only emits. LogTape categories
// ["vitest-playwright", page|net|api|bridge] and one otel: span per attempt. Both peers optional; absent = no-op.
import type { Test } from "@vitest/runner"
import type { ApiEvent, AttemptEvent, NetEvent } from "./6_roots.js"

type Logger = { debug: (m: string, p?: Record<string, unknown>) => void; info: (m: string, p?: Record<string, unknown>) => void; warn: (m: string, p?: Record<string, unknown>) => void; error: (m: string, p?: Record<string, unknown>) => void }
const logtape = await import("@logtape/logtape").then(m => m, () => null)
const otel = await import("@opentelemetry/api").then(m => m.trace.getTracer("vitest-playwright"), () => null)
const get = (name: string): Logger | null => (logtape ? (logtape.getLogger(["vitest-playwright", name]) as Logger) : null)
export const log = { page: get("page"), net: get("net"), api: get("api"), bridge: get("bridge") }

export function logEvent(testId: string, ev: AttemptEvent): void {
  switch (ev.kind) {
    case "error": return log.page?.error("pageerror {message} at {url}", { testId, ...ev.event })
    case "console": return (ev.event.type === "error" ? log.page?.warn : log.page?.debug)?.call(log.page, "console.{type} {text}", { testId, ...ev.event })
    case "net": return logNet({ ...ev.event, owner: testId })
  }
}
export function logNet(e: NetEvent): void {
  const l = log.net
  if (!l) return
  if (e.phase === "failed") l.warn("{realm} {method} {url} failed {failure} {ms}ms", e as any)
  else if (e.phase === "response") l.info("{realm} {method} {url} {status} {ms}ms", e as any)
  else l.debug("{realm} {method} {url} start", e as any)
}
export function logApi(e: ApiEvent): void {
  if (e.fakeTimers) log.bridge?.warn("pw api {title} called under vi.useFakeTimers; the playwright client needs real timers, use context.clock for page time", { owner: e.owner })
  ;(e.error ? log.api?.warn : log.api?.debug)?.call(log.api, "{title} {ms}ms {error}", e as any)
}
export function logBridge(message: string, props: Record<string, unknown> = {}): void {
  log.bridge?.warn(message, props)
}

export function testSpan(task: Test): { end: (state: string | undefined) => void } {
  const span = otel?.startSpan("pw.test", { attributes: { "vitest.test.id": task.id, "vitest.test.name": task.name, "vitest.test.file": task.file.filepath } })
  return { end: state => { if (state === "fail") span?.setStatus?.({ code: 2 }); span?.end?.() } }
}
