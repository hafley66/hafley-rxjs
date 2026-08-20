import { Observable } from "rxjs"
import type { Frame, Renderer } from "./0_types"

/** The three moments of a renderer's life, in subscribe / next / unsubscribe order. */
export type RendererHooks<State> = {
  subscribe: (host: HTMLElement) => State
  next: (state: State, frame: Frame) => void
  unsubscribe: (state: State) => void
}

/** Frames pass through unchanged so renderers chain: `frame$.pipe(pixi(a), dom(b))`. A throw in `next` errors the subscriber; teardown still runs. */
export function renderer<State>(hooks: RendererHooks<State>): Renderer {
  return host => frame$ =>
    new Observable<Frame>(subscriber => {
      const state = hooks.subscribe(host)
      const sub = frame$.subscribe({
        next: frame => {
          try {
            hooks.next(state, frame)
          } catch (error) {
            subscriber.error(error)
            return
          }
          subscriber.next(frame)
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
