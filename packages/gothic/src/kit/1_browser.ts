import { combineLatest, defer, distinctUntilChanged, fromEvent, map, Observable, of, shareReplay, startWith, switchMap } from "rxjs"

export const documentVisible$ = defer(() => typeof document === "undefined" ? of(true) :
  fromEvent(document, "visibilitychange").pipe(startWith(null), map(() => !document.hidden), distinctUntilChanged()))
  .pipe(shareReplay({ bufferSize: 1, refCount: true }))

// Native observer lifetime is the source lifetime; the consuming signal owns it.
export function inViewport(node$: Observable<Element | null>): Observable<boolean> {
  return combineLatest([documentVisible$, node$.pipe(distinctUntilChanged(), switchMap(node => node ? new Observable<boolean>(observer => {
    const intersection = new IntersectionObserver(entries => observer.next(entries[0].isIntersecting))
    intersection.observe(node)
    return () => intersection.disconnect()
  }).pipe(startWith(false)) : of(false)))]).pipe(map(([shown, intersecting]) => shown && intersecting), distinctUntilChanged())
}
