import { Signal } from "@hafley66/signals"
import { combineLatest, defer, distinctUntilChanged, fromEvent, map, Observable, of, shareReplay, startWith, switchMap } from "rxjs"

// the page play knob (?page.run); PagePanel is its one writer. Every clock gating on documentVisible$ follows it.
export const pagePlaying = Signal<boolean>(true)

const tabVisible$ = defer(() => typeof document === "undefined" ? of(true) :
  fromEvent(document, "visibilitychange").pipe(startWith(null), map(() => !document.hidden), distinctUntilChanged()))

// "can play": the tab is shown and the page play knob is on
export const documentVisible$ = combineLatest([tabVisible$, pagePlaying.$]).pipe(
  map(([shown, playing]) => shown && playing), distinctUntilChanged(), shareReplay({ bufferSize: 1, refCount: true }))

// Native observer lifetime is the source lifetime; the consuming signal owns it.
export function inViewport(node$: Observable<Element | null>): Observable<boolean> {
  return combineLatest([documentVisible$, node$.pipe(distinctUntilChanged(), switchMap(node => node ? new Observable<boolean>(observer => {
    const intersection = new IntersectionObserver(entries => observer.next(entries[0].isIntersecting))
    intersection.observe(node)
    return () => intersection.disconnect()
  }).pipe(startWith(false)) : of(false)))]).pipe(map(([shown, intersecting]) => shown && intersecting), distinctUntilChanged())
}
