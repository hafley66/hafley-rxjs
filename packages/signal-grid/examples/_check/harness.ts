// Mounts every example in a real browser and reports what survived teardown. Loaded only by
// `scripts/examples.mjs`; the registry never imports it.
//
// Two rules make the subscription count mean something.
//
// A first, unrecorded pass mounts and tears down every example, so whatever a page builds once (a
// delegated document listener, a module-level subject) is already built when the recorded pass runs.
//
// Only subscriptions opened from this package's own files are the package's to close. A computed
// signal's dependency subscriptions are opened by `@hafley66/signals` inside `syncDependencies`,
// and that library keeps a read-pinned node's dependencies observed on purpose, so counting them
// would gate every example on a retention no example can release. They are reported separately
// instead, and the recorded number is what a later fix there would move.
import { Observable } from "rxjs"
import { EXAMPLES } from "../index.js"
import type { ExampleCheck } from "../0_types.js"

type Closeable = { readonly closed: boolean }

interface Tracked {
  readonly sub: Closeable
  /** Opened by a direct subscription from a file in `src/` or `examples/`. */
  readonly owned: boolean
}

const tracked: Tracked[] = []
let listenerBalance = 0
let observerBalance = 0

// A frame belonging to this package: vite serves the package root, so its own modules are absolute
// paths under `/src/` or `/examples/`, while every dependency arrives through `/@fs/` or
// `node_modules`.
const OURS = /\/(src|examples)\/[^\s)]+\.ts/
const isOurs = (line: string): boolean =>
  OURS.test(line) && !line.includes("/@fs/") && !line.includes("node_modules")

// The immediate caller, not any frame in the stack. Every rxjs operator subscribes its own source,
// so a chain opened from one package call site would otherwise be counted a dozen times, and the
// inner subscribers rxjs leaves un-flagged would read as leaks. The frame directly above the patch
// is the only one that names who asked for the subscription.
function callerOf(stack: string): string | undefined {
  for (const line of stack.split("\n")) {
    const frame = line.trim()
    if (!frame.startsWith("at ")) continue
    if (frame.includes("_check/harness.ts")) continue
    return frame
  }
  return undefined
}

// Cast through a call signature rather than the declared overload set, because a patch has to
// accept every overload at once and TypeScript picks only the last one to check against.
type SubscribeFn = (this: Observable<unknown>, ...args: unknown[]) => Closeable
const proto = Observable.prototype as unknown as { subscribe: SubscribeFn }
const baseSubscribe = proto.subscribe
proto.subscribe = function patched(this: Observable<unknown>, ...args: unknown[]): Closeable {
  const sub = baseSubscribe.apply(this, args)
  const stack = new Error().stack ?? ""
  const caller = callerOf(stack)
  if (caller !== undefined && isOurs(caller)) tracked.push({ sub, owned: true })
  else if (stack.includes("syncDependencies")) tracked.push({ sub, owned: false })
  return sub
}

const baseAdd = EventTarget.prototype.addEventListener
const baseRemove = EventTarget.prototype.removeEventListener
EventTarget.prototype.addEventListener = function patchedAdd(
  this: EventTarget,
  ...args: Parameters<typeof baseAdd>
): void {
  listenerBalance++
  baseAdd.apply(this, args)
}
EventTarget.prototype.removeEventListener = function patchedRemove(
  this: EventTarget,
  ...args: Parameters<typeof baseRemove>
): void {
  listenerBalance--
  baseRemove.apply(this, args)
}

const baseObserve = ResizeObserver.prototype.observe
const baseUnobserve = ResizeObserver.prototype.unobserve
const baseDisconnect = ResizeObserver.prototype.disconnect
const watched = new WeakMap<ResizeObserver, number>()
ResizeObserver.prototype.observe = function patchedObserve(
  this: ResizeObserver,
  ...args: Parameters<typeof baseObserve>
): void {
  observerBalance++
  watched.set(this, (watched.get(this) ?? 0) + 1)
  baseObserve.apply(this, args)
}
ResizeObserver.prototype.unobserve = function patchedUnobserve(
  this: ResizeObserver,
  ...args: Parameters<typeof baseUnobserve>
): void {
  observerBalance--
  watched.set(this, (watched.get(this) ?? 0) - 1)
  baseUnobserve.apply(this, args)
}
ResizeObserver.prototype.disconnect = function patchedDisconnect(this: ResizeObserver): void {
  observerBalance -= watched.get(this) ?? 0
  watched.set(this, 0)
  baseDisconnect.apply(this)
}

const frame = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })

const hostFor = (): HTMLElement => {
  const host = document.createElement("div")
  host.style.cssText = "inline-size:900px;block-size:420px;position:relative"
  document.body.append(host)
  return host
}

const failedCheck = (id: string, reason: string): ExampleCheck => ({
  id,
  ok: false,
  failures: [reason],
  sourceBytes: 0,
  rowsRendered: 0,
  nodesAfterTeardown: 0,
  openOwned: 0,
  retainedByDeps: 0,
  listenerBalance: 0,
  observerBalance: 0,
})

// Two cycles rather than one: a handle an example forgets to stop on rebuild shows as growth even
// when a single cycle happens to balance.
const CYCLES = 2

async function once(index: number, record: boolean): Promise<ExampleCheck> {
  const example = EXAMPLES[index]
  if (example === undefined) return failedCheck(`index-${index}`, "no example at this index")
  const failures: string[] = []
  if (record) {
    tracked.length = 0
    listenerBalance = 0
    observerBalance = 0
  }
  const host = hostFor()
  let rows = 0
  for (let cycle = 0; cycle < (record ? CYCLES : 1); cycle++) {
    let teardown: (() => void) | undefined
    try {
      teardown = example.mount(host)
      await frame()
      rows = host.querySelectorAll("[data-route='r']").length
      if (host.childElementCount === 0) failures.push("mount put nothing in the host")
      if (rows === 0) failures.push("no rows rendered")
    } catch (error) {
      failures.push(`mount threw: ${String(error)}`)
    }
    try {
      teardown?.()
      await frame()
    } catch (error) {
      failures.push(`teardown threw: ${String(error)}`)
    }
  }
  let openOwned = 0
  let retainedByDeps = 0
  for (const entry of tracked) {
    if (entry.sub.closed) continue
    if (entry.owned) openOwned++
    else retainedByDeps++
  }
  const nodesAfterTeardown = host.childElementCount
  host.remove()
  if (example.source.length === 0) failures.push("source is empty")
  if (nodesAfterTeardown !== 0) failures.push(`${nodesAfterTeardown} nodes left in the host`)
  if (record) {
    if (openOwned > 0) failures.push(`${openOwned} package-owned subscriptions still open`)
    if (listenerBalance > 0) failures.push(`${listenerBalance} event listeners never removed`)
    if (observerBalance > 0) failures.push(`${observerBalance} resize observations never released`)
  }
  return {
    id: example.id,
    ok: failures.length === 0,
    failures,
    sourceBytes: example.source.length,
    rowsRendered: rows,
    nodesAfterTeardown,
    openOwned,
    retainedByDeps,
    listenerBalance,
    observerBalance,
  }
}

async function run(): Promise<readonly ExampleCheck[]> {
  for (let i = 0; i < EXAMPLES.length; i++) await once(i, false)
  const results: ExampleCheck[] = []
  for (let i = 0; i < EXAMPLES.length; i++) results.push(await once(i, true))
  return results
}

// The heap pass is driven one step at a time from node, because the sample has to be taken over CDP
// between the steps and a page-side loop leaves no seam to read `JSHeapUsedSize` in.
const held = new Map<number, { readonly host: HTMLElement; readonly teardown: () => void }>()

async function mountOne(index: number): Promise<number> {
  const example = EXAMPLES[index]
  if (example === undefined) return 0
  const host = hostFor()
  const teardown = example.mount(host)
  await frame()
  held.set(index, { host, teardown })
  return host.querySelectorAll("[data-route='r']").length
}

async function teardownOne(index: number): Promise<number> {
  const entry = held.get(index)
  if (entry === undefined) return -1
  entry.teardown()
  await frame()
  const left = entry.host.childElementCount
  entry.host.remove()
  held.delete(index)
  return left
}

declare global {
  interface Window {
    __exampleCheck?: () => Promise<readonly ExampleCheck[]>
    __exampleMount?: (index: number) => Promise<number>
    __exampleTeardown?: (index: number) => Promise<number>
    __exampleIds?: readonly string[]
    __ready?: boolean
  }
}

window.__exampleCheck = run
window.__exampleMount = mountOne
window.__exampleTeardown = teardownOne
window.__exampleIds = EXAMPLES.map((example) => example.id)
window.__ready = true
