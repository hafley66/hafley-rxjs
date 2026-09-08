// pkg:roots. One sig:Signal root per lifetime. The attempt log is Signal(observable): it connects when the
// pkg:aroundEach boundary subscribes and disconnects at release; nothing else subscribes.
import { AsyncLocalStorage } from "node:async_hooks"
import type { Test } from "@vitest/runner"
import type { Observable } from "rxjs"
import { scan } from "rxjs/operators"
import { Signal, type Signal as SignalType } from "@hafley66/signals"
import type { Browser, BrowserContext, Page } from "playwright"
import type { ResolvedOptions } from "./0_options.js"

export type Phase = "setup" | "run" | "capture" | "release"
export interface PageError { message: string; url: string }
export interface ConsoleLine { type: string; text: string; url: string }
export interface ApiEvent { apiName: string; title: string; ms: number; error?: string; owner?: string; fakeTimers?: boolean }
/** One fetch knob in either realm: browser (pw:Page request/response/requestfailed) or node (undici behind global fetch). */
export interface NetEvent { realm: "browser" | "node"; phase: "request" | "response" | "failed"; method: string; url: string; ms: number; status?: number; resourceType?: string; fromServiceWorker?: boolean; failure?: string; owner?: string }
export type AttemptEvent = { kind: "error"; event: PageError } | { kind: "console"; event: ConsoleLine } | { kind: "net"; event: NetEvent }

export type WorkerRootState = { options: ResolvedOptions; baseURL: string | undefined; browser: Browser | null }
export type WorkerRoot = SignalType<WorkerRootState>
export function workerRoot(options: ResolvedOptions, baseURL: string | undefined): WorkerRoot {
  return Signal<WorkerRootState>({ options, baseURL, browser: null })
}

export type TestRootState = {
  task: { id: string; name: string; file: string; retry: number; repeat: number }
  signal: AbortSignal
  options: ResolvedOptions
  context: BrowserContext | null
  page: Page | null
  phase: Phase
}
export type TestRoot = SignalType<TestRootState>
/** vitest: one AbortController per test for every retry, so a timed-out first attempt leaves ctx.signal aborted
 *  forever. Each attempt gets its own signal: follows ctx.signal while that is live, else the task timeout. */
export function attemptSignal(ctxSignal: AbortSignal, timeoutMs: number, sleep: (ms: number, cb: () => void) => void): AbortSignal {
  const attempt = new AbortController()
  if (!ctxSignal.aborted) ctxSignal.addEventListener("abort", () => attempt.abort(ctxSignal.reason), { once: true })
  else if (timeoutMs > 0) sleep(timeoutMs, () => attempt.abort(new Error(`attempt exceeded ${timeoutMs}ms`)))
  return attempt.signal
}
export function testRoot(task: Test, signal: AbortSignal, options: ResolvedOptions): TestRoot {
  return Signal<TestRootState>({
    task: { id: task.id, name: task.name, file: task.file.filepath, retry: task.result?.retryCount ?? 0, repeat: task.result?.repeatCount ?? 0 },
    signal, options, context: null, page: null, phase: "setup",
  })
}

export type TestLogState = { errors: PageError[]; console: ConsoleLine[]; net: NetEvent[] }
export type TestLog = SignalType<TestLogState>
const emptyLog: TestLogState = { errors: [], console: [], net: [] }
function fold(l: TestLogState, ev: AttemptEvent): TestLogState {
  switch (ev.kind) {
    case "error": return { ...l, errors: [...l.errors, ev.event] }
    case "console": return { ...l, console: [...l.console, ev.event] }
    case "net": return { ...l, net: [...l.net, ev.event] }
  }
}
/** The attempt log as a projection of its event stream; connected only while the boundary subscribes `log.$`. */
export function testLog(events$: Observable<AttemptEvent>): TestLog {
  return Signal<TestLogState>(events$.pipe(scan(fold, emptyLog)), emptyLog)
}

export type FileRootState = { context: BrowserContext; page: Page; activeAttempt: string | null }
export type FileRoot = SignalType<FileRootState>
export function fileRoot(context: BrowserContext, page: Page): FileRoot {
  return Signal<FileRootState>({ context, page, activeAttempt: null })
}

export type AttemptStore = { root: TestRoot; log: TestLog }
// One slot per process: a project that loads the plugin from src and a test from dist must still share one bridge.
const slot = Symbol.for("vitest-playwright:bridge")
const bridge: { als: AsyncLocalStorage<AttemptStore>; active: Set<AttemptStore>; taskRoots: WeakMap<Test, AttemptStore> } =
  ((globalThis as any)[slot] ??= { als: new AsyncLocalStorage<AttemptStore>(), active: new Set(), taskRoots: new WeakMap() })
/** node:AsyncLocalStorage entered by the pkg:aroundEach hook; `$page` and the matchers read it. */
export const als = bridge.als
/** Attempts in phase run/capture on this worker. `$page` falls back to the sole member when the store is missing
 *  (pw: event dispatch and route handlers run outside the test's async context). */
export const active = bridge.active
/** Bridge for code vitest runs outside the store (context/page fixtures, onTestFailed callers). */
export const taskRoots = bridge.taskRoots

// worker-level singletons, owned by 4_test's worker fixture (release) and readable by 8_around
export const workerState: { root: WorkerRoot | null } = { root: null }
