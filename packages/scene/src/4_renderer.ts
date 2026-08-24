import { Observable } from "rxjs"
import type { Frame, Renderer } from "./0_types"

/** The three moments of a renderer's life, in subscribe / next / unsubscribe order. */
export type RendererHooks<State, T> = {
  subscribe: (host: HTMLElement) => State
  next: (state: State, value: T) => void
  unsubscribe: (state: State) => void
}

/** Frames pass through unchanged so renderers chain: `frame$.pipe(pixi(a), dom(b))`. A throw in `next` errors the subscriber; teardown still runs. */
export function renderer<State, T = Frame>(hooks: RendererHooks<State, T>): Renderer<T> {
  return host => source$ =>
    new Observable<T>(subscriber => {
      const state = hooks.subscribe(host)
      const sub = source$.subscribe({
        next: value => {
          try {
            hooks.next(state, value)
          } catch (error) {
            subscriber.error(error)
            return
          }
          subscriber.next(value)
        },
        error: error => subscriber.error(error),
        complete: () => subscriber.complete(),
      })
      return () => {
        sub.unsubscribe()
        hooks.unsubscribe(state)
      }
    })
}
