import { Observable, type OperatorFunction } from "rxjs"
import type { Signal } from "./0_types.js"
import { trackDependencies } from "./1_SignalCreator.js"

// Pipe operator: project source emissions against tracked signal values, and
// re-emit when any signal read in the projection changes. Never completes.
export function signalMap<I, O>(
  project: (source: I) => O,
): OperatorFunction<I, O> {
  return (source: Observable<I>): Observable<O> =>
    new Observable<O>((subscriber) => {
      let latestSource: { value: I } | undefined
      let lastOutput: { value: O } | undefined
      let depSubs: Array<{ unsubscribe(): void }> = []
      let running = false
      let dirty = false

      const unsubscribeDeps = () => {
        for (const sub of depSubs) sub.unsubscribe()
        depSubs = []
      }

      const subscribeDep = (dep: Signal<unknown>) => {
        let initializing = true
        const sub = dep.$.subscribe(() => {
          if (initializing) return
          if (running) {
            dirty = true
            return
          }
          recompute()
        })
        initializing = false
        depSubs.push(sub)
      }

      const run = () => {
        const deps = new Set<Signal<unknown>>()
        let next: O
        try {
          next = trackDependencies(() => project(latestSource!.value), deps)
        } catch (error) {
          // keep last output; resubscribe to deps read before the throw.
          unsubscribeDeps()
          for (const dep of deps) subscribeDep(dep)
          if (lastOutput !== undefined) return
          subscriber.error(error)
          return
        }

        unsubscribeDeps()
        for (const dep of deps) subscribeDep(dep)
        lastOutput = { value: next }
        subscriber.next(next)
      }

      const recompute = () => {
        if (!latestSource) return
        if (running) {
          dirty = true
          return
        }
        running = true
        try {
          run()
        } finally {
          running = false
        }
        if (dirty) {
          dirty = false
          recompute()
        }
      }

      const sourceSub = source.subscribe({
        next: (value) => {
          latestSource = { value }
          recompute()
        },
        error: (e) => subscriber.error(e),
        // no complete handler: signals never complete, so output stays open.
      })

      return () => {
        sourceSub.unsubscribe()
        unsubscribeDeps()
      }
    })
}
