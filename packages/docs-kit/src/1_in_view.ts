// @comment-ok: the host-binding contract and the one-observer-per-page contract are the two invariants this file exists to hold
// The reversal. A demo names a source; the page decides when it runs. A docs page mounting
// twenty-four demos holds subscriptions for the demos a reader can see and none for the rest.
//
// The gating element is not passed to `runWhenInView`. `mountInView` binds it for the length of one
// synchronous mount call and restores what was bound before returning, so the module-level binding
// is never live across two mounts: no mount yields while another starts. A call made with nothing
// bound throws, because a runner with no host is a subscription that never stops.
//
// One `IntersectionObserver` serves the whole page, opened by the first runner and disconnected by
// the last. Its `rootMargin` reports a host before it is visible, which is the edge a reader
// scrolling toward a demo crosses first. A host removed from the document reports as leaving on
// that same observer, so removal needs no second watcher.
import { Observable, Subscription } from "rxjs"
import { isSignal, Signal } from "@hafley66/signals"

/** Roughly five standard rows, so a fast scroll still starts a demo before it paints. */
export const DEFAULT_BUFFER_PX = 200

/** The two shapes that can carry an effect. A thunk has nowhere to put a `tap`, and a bare value
 * emits once and never again, so neither is accepted. */
export type InViewSource<T> = Signal<T> | Observable<T>

function streamOf<T>(source: InViewSource<T>): Observable<T> {
  return isSignal<T>(source) ? source.$ : source
}

/** Every runner on one host, so two runners sharing a host share one observation. */
interface Watch {
  readonly runners: Set<(near: boolean) => void>
}

const byHost = new Map<HTMLElement, Watch>()

let observer: IntersectionObserver | null = null

function openObserver(): IntersectionObserver {
  const open = observer
  if (open !== null) return open
  const opened = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const watch = byHost.get(entry.target as HTMLElement)
        if (watch === undefined) continue
        // Copied: a runner torn down by its own effect would otherwise mutate the set mid-loop.
        for (const runner of [...watch.runners]) runner(entry.isIntersecting)
      }
    },
    { rootMargin: `${DEFAULT_BUFFER_PX}px 0px` },
  )
  observer = opened
  return opened
}

function watchOf(host: HTMLElement): Watch {
  const found = byHost.get(host)
  if (found !== undefined) return found
  const watch: Watch = { runners: new Set() }
  byHost.set(host, watch)
  openObserver().observe(host)
  return watch
}

function releaseWatch(host: HTMLElement, watch: Watch): void {
  if (watch.runners.size > 0) return
  observer?.unobserve(host)
  byHost.delete(host)
  if (byHost.size > 0) return
  observer?.disconnect()
  observer = null
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
