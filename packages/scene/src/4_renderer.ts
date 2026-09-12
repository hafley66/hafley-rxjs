import { defer, finalize, tap } from "rxjs"
import type { Frame, Renderer } from "./0_types"

export type RendererResource<T> = {
  render(value: T): void
  unsubscribe(): void
}

/** Values pass through unchanged so renderer resources chain. A throw in `render` errors the subscriber; teardown still runs. */
export function renderer<T = Frame>(acquire: (host: HTMLElement) => RendererResource<T>): Renderer<T> {
  return host => source$ =>
    defer(() => {
      const resource = acquire(host)
      return source$.pipe(
        tap(value => resource.render(value)),
        finalize(() => resource.unsubscribe()),
      )
    })
}
