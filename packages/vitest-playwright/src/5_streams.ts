// pkg:streams. rx: producers of pkg:Resource<T>; `acquire()` is the only subscriber and its handle's
// `release()` awaits the async close (rx:Subscription.unsubscribe is sync, so the close promise lives here).
// Time in this file runs on `real`, timers captured at import, so vitest:vi.useFakeTimers cannot freeze the bridge.

import { subscribe as dcSubscribe, unsubscribe as dcUnsubscribe } from "node:diagnostics_channel"
import { mkdirSync } from "node:fs"
import playwright, {
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type ConsoleMessage,
  type Page,
  type Request,
  type Response,
} from "playwright"
import { defer, from, fromEvent, merge, NEVER, Observable, of, race, throwError } from "rxjs"
import {
  catchError,
  defaultIfEmpty,
  distinctUntilChanged,
  filter,
  map,
  retry,
  switchMap,
  takeUntil,
} from "rxjs/operators"
import { vi } from "vitest"
import type { ResolvedOptions } from "./0_options.js"
import type { ApiEvent, AttemptEvent, NetEvent, TestRoot } from "./6_roots.js"
import { als } from "./6_roots.js"

/** node: timers captured before any test can fake them. */
export const real = {
  setTimeout: globalThis.setTimeout.bind(globalThis),
  clearTimeout: globalThis.clearTimeout.bind(globalThis),
  now: () => performance.now(),
}
/** rx: one tick after `ms` on the real clock, then complete. */
export function sleep$(ms: number): Observable<number> {
  return new Observable(s => {
    const id = real.setTimeout(() => {
      s.next(ms)
      s.complete()
    }, ms)
    return () => real.clearTimeout(id)
  })
}

export interface Resource<T> {
  value: T
  close: () => Promise<void>
}
export interface Handle<T> {
  value: T
  release: () => Promise<void>
}

/** Cold producer from an async acquire + async close. Teardown is sync (rx), the close promise is returned by release(). */
export function resource$<T>(open: () => Promise<T>, close: (value: T) => Promise<void>): Observable<Resource<T>> {
  return new Observable(sub => {
    open().then(
      value => sub.next({ value, close: () => close(value) }),
      e => sub.error(e),
    )
    return () => {}
  })
}

export function acquire<T>(src$: Observable<Resource<T>>): Promise<Handle<T>> {
  return new Promise((resolve, reject) => {
    let got = false
    const sub = src$.subscribe({
      next: r => {
        if (got) return
        got = true
        let closing: Promise<void> | undefined
        const release = () => {
          if (!closing)
            closing = (async () => {
              sub.unsubscribe()
              await r.close()
            })()
          return closing
        }
        resolve({ value: r.value, release })
      },
      error: reject,
      complete: () => {
        if (!got) reject(new Error("resource completed without a value"))
      },
    })
  })
}

export function browser$(o: ResolvedOptions): Observable<Resource<Browser>> {
  const type = playwright[o.browser.name]
  return resource$(
    () =>
      o.browser.connect
        ? type.connect(o.browser.connect.wsEndpoint, { headers: o.browser.connect.headers })
        : type.launch({ handleSIGINT: false, ...o.browser.launch }),
    b => b.close({ reason: "vitest worker end" }),
  )
}

export interface ContextHooks {
  attemptDir?: string
  video?: boolean
}

export function context$(
  browser: Browser,
  o: ResolvedOptions,
  ctxOpts: BrowserContextOptions,
  hooks: ContextHooks = {},
): Observable<Resource<BrowserContext>> {
  return resource$(
    async () => {
      if (hooks.video && hooks.attemptDir) mkdirSync(hooks.attemptDir, { recursive: true })
      const c = await browser.newContext({
        ...ctxOpts,
        ...(hooks.video && hooks.attemptDir ? { recordVideo: { dir: hooks.attemptDir } } : {}),
      })
      c.setDefaultTimeout(o.timeouts.action)
      c.setDefaultNavigationTimeout(o.timeouts.navigation)
      if (o.har)
        await c.routeFromHAR(o.har.path, {
          update: o.har.update,
          url: o.har.url ? new RegExp(o.har.url.source, o.har.url.flags) : undefined,
        })
      if (o.clock.install) {
        const time = o.clock.time
        if (o.clock.mode === "fixed") await c.clock.setFixedTime(time ?? 0)
        else {
          await c.clock.install(time !== undefined ? { time } : {})
          if (o.clock.mode === "paused") await c.clock.pauseAt(time ?? 0)
        }
      }
      if (o.artifacts.trace !== "off") await c.tracing.start({ screenshots: true, snapshots: true })
      return c
    },
    async c => {
      await c.close()
    },
  )
}

export function page$(context: BrowserContext): Observable<Resource<Page>> {
  return resource$(
    () => context.newPage(),
    async () => {},
  )
}

export function request$(o: ResolvedOptions, baseURL: string | undefined): Observable<Resource<APIRequestContext>> {
  const c = o.context
  return resource$(
    () =>
      playwright.request.newContext({
        baseURL: baseURL ?? c.baseURL,
        extraHTTPHeaders: c.extraHTTPHeaders,
        httpCredentials: c.httpCredentials,
        ignoreHTTPSErrors: c.ignoreHTTPSErrors,
        storageState: c.storageState,
        proxy: c.proxy,
      }),
    r => r.dispose(),
  )
}

/** Browser realm: pw:Page events. `request` starts the clock for its `response` / `requestfailed`. */
export function pageEvents$(page: Page): Observable<AttemptEvent> {
  const t0 = new WeakMap<Request, number>()
  const net = (r: Request, phase: NetEvent["phase"], rest: Partial<NetEvent> = {}): NetEvent => ({
    realm: "browser",
    phase,
    method: r.method(),
    url: r.url(),
    resourceType: r.resourceType(),
    ms: Math.round(real.now() - (t0.get(r) ?? real.now())),
    ...rest,
  })
  return merge(
    fromEvent<Error>(page, "pageerror").pipe(
      map(e => ({ kind: "error" as const, event: { message: String(e?.message ?? e), url: page.url() } })),
    ),
    fromEvent<ConsoleMessage>(page, "console").pipe(
      map(m => ({ kind: "console" as const, event: { type: m.type(), text: m.text(), url: page.url() } })),
    ),
    fromEvent<Request>(page, "request").pipe(
      map(r => {
        t0.set(r, real.now())
        return { kind: "net" as const, event: net(r, "request") }
      }),
    ),
    fromEvent<Response>(page, "response").pipe(
      map(res => ({
        kind: "net" as const,
        event: net(res.request(), "response", { status: res.status(), fromServiceWorker: res.fromServiceWorker() }),
      })),
    ),
    fromEvent<Request>(page, "requestfailed").pipe(
      map(r => ({ kind: "net" as const, event: net(r, "failed", { failure: r.failure()?.errorText }) })),
    ),
  )
}

/** Both realms for one attempt: events of the page the root points at (root writes re-emit the projection; distinct
 *  keeps one page) plus node-realm fetches whose als owner is this attempt. */
export function attemptEvents$(root: TestRoot): Observable<AttemptEvent> {
  const id = root.task.id.$()
  return merge(
    root.page.$.pipe(
      distinctUntilChanged(),
      filter((p): p is Page => !!p),
      switchMap(p => pageEvents$(p)),
    ),
    nodeFetch$().pipe(
      filter(n => n.owner === id),
      map(event => ({ kind: "net" as const, event })),
    ),
  )
}

// node: the undici request object as published on its diagnostics channels
type UndiciRequest = { method: string; origin: string; path: string }
type UndiciMessage = { request: UndiciRequest; response?: { statusCode: number }; error?: unknown }

/** Node realm: undici diagnostics channels behind global fetch. Owner = the als store at request creation. */
export function nodeFetch$(): Observable<NetEvent> {
  return new Observable<NetEvent>(sub => {
    const t0 = new WeakMap<object, number>()
    const net = (req: UndiciRequest, phase: NetEvent["phase"], rest: Partial<NetEvent> = {}): NetEvent => ({
      realm: "node",
      phase,
      method: req.method,
      url: `${req.origin}${req.path}`,
      ms: Math.round(real.now() - (t0.get(req) ?? real.now())),
      owner: als.getStore()?.root.task.id.$(),
      ...rest,
    })
    const handlers: Record<string, (m: unknown) => void> = {
      "undici:request:create": m => {
        const { request } = m as UndiciMessage
        t0.set(request, real.now())
        sub.next(net(request, "request"))
      },
      "undici:request:headers": m => {
        const { request, response } = m as UndiciMessage
        sub.next(net(request, "response", { status: response?.statusCode }))
      },
      "undici:request:error": m => {
        const { request, error } = m as UndiciMessage
        sub.next(net(request, "failed", { failure: String((error as Error)?.message ?? error) }))
      },
    }
    for (const [ch, h] of Object.entries(handlers)) dcSubscribe(ch, h)
    return () => {
      for (const [ch, h] of Object.entries(handlers)) dcUnsubscribe(ch, h)
    }
  })
}

// pw: the private client instrumentation surface (playwright-core clientInstrumentation.ts)
type ApiCallData = { apiName: string; userData?: ApiUserData; error?: { message?: string } }
type ApiUserData = { t0: number; title: string; owner?: string; fakeTimers?: boolean }
type ApiListener = {
  onApiCallBegin(data: ApiCallData, channel?: { type?: string; method?: string }): void
  onApiCallEnd(data: ApiCallData): void
}
type Instrumented = { _instrumentation?: { addListener(l: ApiListener): void; removeListener(l: ApiListener): void } }

/** pw:_instrumentation listener as a cold producer; one worker-lifetime subscription lives in 4_test. */
export function apiCall$(): Observable<ApiEvent> {
  return new Observable(sub => {
    const inst = (playwright as unknown as Instrumented)._instrumentation
    if (!inst) return () => {}
    const listener: ApiListener = {
      onApiCallBegin(data, channel) {
        data.userData = {
          t0: real.now(),
          title: `${channel?.type ?? ""}.${channel?.method ?? ""}`,
          owner: als.getStore()?.root.task.id.$(),
          fakeTimers: vi.isFakeTimers(),
        }
      },
      onApiCallEnd(data) {
        const u = data.userData ?? {
          t0: real.now(),
          title: data.apiName ?? "?",
          owner: als.getStore()?.root.task.id.$(),
        }
        sub.next({
          apiName: data.apiName,
          title: u.title,
          ms: Math.round(real.now() - u.t0),
          error: data.error?.message,
          owner: u.owner,
          fakeTimers: u.fakeTimers,
        })
      },
    }
    inst.addListener(listener)
    return () => inst.removeListener(listener)
  })
}

export interface PollOptions {
  intervals: number[]
  timeout: number
  isNot: boolean
  signal?: AbortSignal
}
class NotThrown extends Error {}

/** pw:toPass semantics on the real clock: retry the callback on the interval sequence until it passes (or, for .not, until it throws). */
export function poll$(
  cb: () => unknown,
  { intervals, timeout, isNot, signal }: PollOptions,
): Observable<"pass" | "timeout"> {
  const attempt$ = defer(() => from(Promise.resolve().then(cb)))
  const oriented$ = isNot
    ? attempt$.pipe(
        map(() => {
          throw new NotThrown()
        }),
        catchError(e => (e instanceof NotThrown ? throwError(() => e) : of("pass" as const))),
      )
    : attempt$.pipe(map(() => "pass" as const))
  const last = intervals.length - 1
  const retried$ = oriented$.pipe(retry({ delay: (_e, n) => sleep$(intervals[Math.min(n - 1, last)] ?? 1000) }))
  const raced$ = timeout > 0 ? race(retried$, sleep$(timeout).pipe(map(() => "timeout" as const))) : retried$
  if (signal?.aborted) return of("timeout" as const)
  return raced$.pipe(takeUntil(signal ? fromEvent(signal, "abort") : NEVER), defaultIfEmpty("timeout" as const))
}
