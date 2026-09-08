// pkg:aroundEach hook: the node:AsyncLocalStorage boundary. Owns acquire -> run -> capture -> release for one attempt
// and is the one subscriber of the attempt log. Registered from setup.ts (vitest: setupFiles hooks apply to every file).
import { mkdirSync } from "node:fs"
import { join } from "node:path"
import { aroundEach, inject, vi } from "vitest"
import { recordArtifact, type Test } from "@vitest/runner"
import { tap } from "rxjs/operators"
import type { BrowserContextOptions, Page } from "playwright"
import { KEY, type ResolvedOptions } from "./0_options.js"
import { acquire, attemptEvents$, browser$, context$, page$, real, type Handle } from "./5_streams.js"
import { active, als, attemptSignal, taskRoots, testLog, testRoot, workerRoot, workerState, type FileRoot, type TestLog } from "./6_roots.js"
import { logBridge, logEvent, testSpan } from "./10_telemetry.js"

// Lazy worker browser for files whose tests never destructure pkg:test fixtures (plain vitest `it` + $page).
let lazyBrowser: Promise<Handle<import("playwright").Browser>> | undefined
export async function ensureBrowser(o: ResolvedOptions) {
  if (workerState.root?.browser.$()) return workerState.root.browser.$()!
  lazyBrowser ??= acquire(browser$(o)).catch(e => { lazyBrowser = undefined; throw e })
  const h = await lazyBrowser
  workerState.root ??= workerRoot(o, inject(KEY.baseURL))
  workerState.root.browser.$(h.value)
  return h.value
}
export async function releaseLazyBrowser() {
  const h = await lazyBrowser?.catch(() => undefined)
  lazyBrowser = undefined
  await h?.release()
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80)

export function attemptDir(o: ResolvedOptions, task: Test): string {
  const file = slug(task.file.name.replace(/\.[^.]+$/, ""))
  const r = task.result?.retryCount ?? 0
  const p = task.result?.repeatCount ?? 0
  return join(o.artifacts.outDir, file, `${slug(task.name)}.${task.id}.r${r}.p${p}`)
}

/** vitest: fake timers left installed by the body would freeze the pw client during capture/release. */
function realTimers(task: Test, phase: string) {
  if (!vi.isFakeTimers()) return
  vi.useRealTimers()
  logBridge("vi.useFakeTimers was still installed at {phase} of {name}; real timers restored", { phase, name: task.name, testId: task.id })
}

export function registerAround(): void {
  aroundEach(async (runTest, { task, signal, options, baseURL: base, contextOptions: ctxOverride, fileRoot: fileRootFx, browser: browserFx }: any) => {
    const o: ResolvedOptions = options ?? inject(KEY.options)
    const baseURL: string | undefined = base ?? inject(KEY.baseURL)
    const contextOptions: BrowserContextOptions = { ...o.context, baseURL: baseURL ?? o.context.baseURL, ...(ctxOverride ?? {}) }
    const fileRoot: FileRoot | null = fileRootFx ?? null
    realTimers(task, "setup")
    const root = testRoot(task, attemptSignal(signal, task.timeout, (ms, cb) => real.setTimeout(cb, ms)), o)
    const log = testLog(attemptEvents$(root).pipe(tap(ev => { if (o.log.page) logEvent(task.id, ev) })))
    const store = { root, log }
    taskRoots.set(task, store)
    const span = testSpan(task)
    // vitest writes result.repeatCount inside runTest, so the artifact dir is computed at capture; video needs one now
    const videoDir = o.artifacts.video !== "off" ? attemptDir(o, task) : undefined
    await als.run(store, async () => {
      let ctxH: Handle<import("playwright").BrowserContext> | undefined
      let pageH: Handle<Page> | undefined
      let failed = false
      const connection = log.$.subscribe()
      try {
        if (fileRoot) {
          const owner = fileRoot.activeAttempt.$()
          if (owner && owner !== task.id) throw new Error(`contextScope 'file': test ${task.name} started while ${owner} owns the page; file scope requires sequential tests`)
          fileRoot.activeAttempt.$(task.id)
          root.context.$(fileRoot.context.$())
          root.page.$(fileRoot.page.$())
          if (o.artifacts.trace !== "off") await fileRoot.context.$().tracing.startChunk({ title: task.name })
        } else {
          const browser = browserFx ?? (await ensureBrowser(o))
          ctxH = await acquire(context$(browser, o, contextOptions, { attemptDir: videoDir, video: !!videoDir }))
          root.context.$(ctxH.value)
          pageH = await acquire(page$(ctxH.value))
          root.page.$(pageH.value)
        }
        root.phase.$("run")
        active.add(store)
        try {
          await runTest()
        } finally {
          root.phase.$("capture")
          realTimers(task, "capture")
          failed = task.result?.state === "fail"
          const page = root.page.$()
          const dir = videoDir ?? attemptDir(o, task)
          if (page && root.context.$()) await capture(o, task, page, root.context.$()!, dir, failed, fileRoot ? "chunk" : "stop")
          root.phase.$("release")
          assertLog(o, log, task)
        }
      } finally {
        // the one release site; reached from every path above, including a throw before phase run
        active.delete(store)
        connection.unsubscribe()
        if (fileRoot) fileRoot.activeAttempt.$(null)
        try { await pageH?.release() } finally {
          try { await ctxH?.release() } finally {
            if (videoDir && ctxH) await keepOrDropVideos(o, videoDir, failed)
            span.end(task.result?.state)
            taskRoots.delete(task)
          }
        }
      }
    })
  })
}

async function capture(o: ResolvedOptions, task: Test, page: Page, context: import("playwright").BrowserContext, dir: string, failed: boolean, tracing: "stop" | "chunk") {
  const budget = AbortSignal.timeout(o.artifacts.budgetMs)
  const bounded = <T,>(p: Promise<T>) => budget.aborted
    ? Promise.reject(new Error("artifact budget exceeded"))
    : Promise.race([p, new Promise<never>((_, rej) => budget.addEventListener("abort", () => rej(new Error("artifact budget exceeded")), { once: true }))])
  const wantShot = o.artifacts.screenshot === "on" || (o.artifacts.screenshot === "only-on-failure" && failed)
  const wantTrace = o.artifacts.trace === "on" || (o.artifacts.trace === "retain-on-failure" && failed) || (o.artifacts.trace === "on-first-retry" && (task.result?.retryCount ?? 0) === 1)
  if (wantShot || wantTrace) mkdirSync(dir, { recursive: true })
  if (wantShot) {
    const path = join(dir, `${failed ? "failed" : "finished"}.png`)
    try {
      await bounded(page.screenshot({ path, caret: "initial" }))
      if (failed) await recordArtifact(task, { type: "internal:failureScreenshot", attachments: [{ path, originalPath: path, contentType: "image/png" }] } as any)
    } catch (e) { logBridge("screenshot skipped for {name}: {error}", { name: task.name, error: String((e as Error)?.message ?? e) }) }
  }
  if (o.artifacts.trace !== "off") {
    const path = wantTrace ? join(dir, "trace.zip") : undefined
    try { await bounded(tracing === "chunk" ? context.tracing.stopChunk({ path }) : context.tracing.stop({ path })) }
    catch (e) { logBridge("trace stop skipped for {name}: {error}", { name: task.name, error: String((e as Error)?.message ?? e) }) }
  }
}

async function keepOrDropVideos(o: ResolvedOptions, dir: string, failed: boolean) {
  if (o.artifacts.video === "retain-on-failure" && !failed) {
    const { readdirSync, rmSync } = await import("node:fs")
    for (const f of readdirSync(dir)) if (f.endsWith(".webm")) rmSync(join(dir, f), { force: true })
  }
}

function assertLog(o: ResolvedOptions, log: TestLog, task: Test) {
  const l = log.$()
  const errors = [...(o.log.failOnPageError ? l.errors.map(e => `pageerror ${e.message} (${e.url})`) : []), ...(o.log.failOnConsoleError ? l.console.filter(c => c.type === "error").map(c => `console.error ${c.text} (${c.url})`) : [])]
  if (errors.length && task.result?.state !== "fail") throw new Error(`page errors during "${task.name}":\n  - ${errors.join("\n  - ")}`)
}
