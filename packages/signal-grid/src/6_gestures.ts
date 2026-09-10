// Resize, column move, and row move are one gesture with three hit tests. Not signals: a drag is
// `takeUntil` over a live pointer stream, a lifetime bounded by two events.
import { defer, filter, fromEvent, map, merge, Observable, share, switchMap, take, takeUntil } from "rxjs"

/** The two streams a drag listens to between down and up. Separate so a test can feed Subjects. */
export interface DragStreams {
  readonly move$: Observable<PointerEvent>
  readonly up$: Observable<PointerEvent>
}

/** What a delegated pointerdown carries: the event plus the route params of the element hit. */
export type DragDown = PointerEvent & { readonly params: Record<string, string> }

// `D` defaults to a delegated pointerdown. An epic opens its drag from an intent instead, which is
// already the snapshot that event would reduce to, so the down shape is a parameter.
export interface DragSpec<S, A, D = DragDown> {
  /** Null rejects the gesture, so a hit test that misses costs one call and no subscription. */
  readonly from: (down: D) => S | null
  readonly move: (start: S, e: PointerEvent) => A | null
  /** Absent means the last move already said everything, which holds for a preview-only drag. */
  readonly commit?: (start: S, e: PointerEvent) => A | null
}

// `defer` twice: node test runs import this module with no `window`, so the reference must wait
// for a subscribe rather than run at module load.
export const WINDOW_DRAG: DragStreams = {
  move$: defer(() => fromEvent<PointerEvent>(window, "pointermove")),
  up$: defer(() => fromEvent<PointerEvent>(window, "pointerup")),
}

let active: DragStreams = WINDOW_DRAG

/** `grid()` builds its own epics, so nothing can pass Subjects in from outside. This is that seam. */
export function setDragStreams(next: DragStreams): () => void {
  const previous = active
  active = next
  return () => {
    active = previous
  }
}

/** Reads `active` per subscription, so a swap made after an epic was built still takes effect. */
export const LIVE_DRAG: DragStreams = {
  move$: defer(() => active.move$),
  up$: defer(() => active.up$),
}

// `merge` rather than `concat`: concat subscribes to `up$` only after `takeUntil(up$)` closed the
// move phase, one delivery too late, so the commit would wait for a second pointerup.
export function drag<S, A, D = DragDown>(
  down$: Observable<D>,
  spec: DragSpec<S, A, D>,
  streams: DragStreams = LIVE_DRAG,
): Observable<A> {
  const commit = spec.commit
  return down$.pipe(
    map((down) => spec.from(down)),
    filter((start): start is S => start !== null),
    switchMap((start) => {
      // Shared `take(1)` so the move phase and the commit read one emission, not two.
      const up$ = streams.up$.pipe(take(1), share())
      return merge(
        streams.move$.pipe(
          takeUntil(up$),
          map((it) => spec.move(start, it)),
        ),
        up$.pipe(map((it) => (commit === undefined ? null : commit(start, it)))),
      )
    }),
    filter((action): action is A => action !== null),
  )
}

// A neighbour is crossed at half of it, which is what keeps a slow drag from flickering between
// two slots.
export function landingIndex(
  order: readonly string[],
  from: number,
  delta: number,
  sizeOf: (key: string) => number,
): number {
  let index = from
  let travelled = 0
  const step = delta > 0 ? 1 : -1
  const distance = Math.abs(delta)
  while (index + step >= 0 && index + step < order.length) {
    const key = order[index + step]
    if (key === undefined) break
    const size = sizeOf(key)
    if (travelled + size / 2 > distance) break
    travelled += size
    index += step
  }
  return index
}
