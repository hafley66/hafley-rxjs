// @comment-ok: the host-binding contract and the one-observer-per-page contract are the two invariants this file exists to hold
// @no-features: the subscription runner. It decides when a demo's pipeline is open and claims no grid behaviour of its own
// The reversal. A demo names a source; the page decides when it runs. A docs page mounting
// twenty-four grids holds subscriptions for the grids a reader can see and none for the rest.
//
// The gating element is not passed to `runWhenInView`. `mountInView` binds it for the length of one
// synchronous mount call and restores what was bound before returning, so the module-level binding
// is never live across two mounts: no mount yields while another starts. A call made with nothing
// bound throws, because a runner with no host is a subscription that never stops.
//
// One `MeasureStore` serves the whole page, opened by the first runner and closed by the last.
// `src/14_measure.ts` already holds an `IntersectionObserver` with the `rootMargin` buffer that
// reports an entry before it is visible, which is the edge a reader scrolling toward a demo crosses
// first. A host removed from the document reports as leaving on that same observer, so removal
// needs no second watcher.
import { isObservable, Observable, Subscription } from "rxjs"
import { isSignal, Signal } from "@hafley66/signals"
import { createMeasureStore, DEFAULT_BUFFER_PX, type MeasureStore } from "./14_measure.js"

/** The two shapes that can carry an effect. A thunk has nowhere to put a `tap`, and a bare value
 * emits once and never again, so neither is accepted. */
export type InViewSource<T> = Signal<T> | Observable<T>

function streamOf<T>(source: InViewSource<T>): Observable<T> {
  return isSignal<T>(source) ? source.$ : source
}

/** Every runner on one host, so two runners sharing a host share one observation. */
interface Watch {
  readonly key: string
  readonly release: () => void
  readonly runners: Set<(near: boolean) => void>
}

const byHost = new Map<HTMLElement, Watch>()
const byKey = new Map<string, Watch>()

let store: MeasureStore | null = null
let storeSubs: Subscription | null = null
let nextKey = 0

function tell(keys: readonly string[], near: boolean): void {
  for (const key of keys) {
    const watch = byKey.get(key)
    if (watch === undefined) continue
    // Copied: a runner torn down by its own effect would otherwise mutate the set mid-loop.
    for (const runner of [...watch.runners]) runner(near)
  }
}

function openStore(): MeasureStore {
  const open = store
  if (open !== null) return open
  // Vertical against the document viewport, which is what a page-scrolled docs page has.
  const opened = createMeasureStore({
    initial: 0,
    direction: "vertical",
    onChange: () => {},
    bufferPx: DEFAULT_BUFFER_PX,
  })
  const subs = new Subscription()
  subs.add(opened.approaching$.subscribe((keys) => tell(keys, true)))
  subs.add(opened.leaving$.subscribe((keys) => tell(keys, false)))
  store = opened
  storeSubs = subs
  return opened
}

function closeStore(): void {
  storeSubs?.unsubscribe()
  storeSubs = null
  store?.close()
  store = null
}

function watchOf(host: HTMLElement): Watch {
  const found = byHost.get(host)
  if (found !== undefined) return found
  const key = `in-view-${nextKey++}`
  const watch: Watch = { key, release: openStore().observe(key, host), runners: new Set() }
  byHost.set(host, watch)
  byKey.set(key, watch)
  return watch
}

function releaseWatch(host: HTMLElement, watch: Watch): void {
  if (watch.runners.size > 0) return
  watch.release()
  byHost.delete(host)
  byKey.delete(watch.key)
  if (byHost.size === 0) closeStore()
}

/** The host of the mount running right now. Written only by `mountInView`. */
let mounting: HTMLElement | null = null

/** Binds `host` for the length of `mount`, so every `runWhenInView` inside it names a source and
 * nothing else. Returns what `mount` returned: a teardown in an example, a handle in a demo. */
export function mountInView<T>(host: HTMLElement, mount: () => T): T {
  const outer = mounting
  mounting = host
  try {
    return mount()
  } finally {
    mounting = outer
  }
}

/** Whether a host is bound, for a caller that would rather branch than catch. */
export const hasInViewHost = (): boolean => mounting !== null

/** Subscribes when the host reaches the buffer zone, unsubscribes when it leaves, and returns the
 * teardown. One argument, so an effect is written as `source.pipe(tap(...))`. */
export function runWhenInView<T>(source: InViewSource<T>): () => void {
  const host = mounting
  if (host === null) {
    throw new Error(
      "runWhenInView has no host. Wrap the mount that calls it in mountInView(host, ...).",
    )
  }
  const stream = streamOf(source)
  const watch = watchOf(host)
  let open: Subscription | null = null
  let stopped = false

  const runner = (near: boolean): void => {
    if (stopped) return
    if (!near) {
      open?.unsubscribe()
      open = null
      return
    }
    if (open !== null) return
    open = stream.subscribe()
  }

  watch.runners.add(runner)
  return () => {
    if (stopped) return
    stopped = true
    open?.unsubscribe()
    open = null
    watch.runners.delete(runner)
    releaseWatch(host, watch)
  }
}
