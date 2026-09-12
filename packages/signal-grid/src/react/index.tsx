// React mounts the box. The grid owns every node inside it, because the scroll matrix in
// `bench/README.md` puts the package at 17% of a frame at its breaking point and reconciling
// 8,915 cell nodes per scroll would spend the other 83% twice.
import { createElement, useEffect, useRef, type CSSProperties, type ReactElement, type ReactNode } from "react"
import { createRoot } from "react-dom/client"
import { render } from "../10_render.js"
import type { Renderable, Slot, SlotContent } from "../0_types.js"
import type { Grid } from "../8_grid.js"

export interface GridViewProps<TRow> {
  readonly grid: Grid<TRow>
  readonly className?: string
  readonly style?: CSSProperties
}

/**
 * The whole React surface for a grid. `render` decorates the element it is handed and returns the
 * teardown, which is exactly an effect's contract, so the adapter is the effect and nothing else.
 *
 * The grid is the identity: pass the same `grid` across re-renders and the DOM is never rebuilt.
 * Rebuilding on every parent render is the one way to lose the performance this package exists for.
 */
export function GridView<TRow>({ grid, className, style }: GridViewProps<TRow>): ReactElement {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = host.current
    if (el === null) return
    return render(grid, el).stop
  }, [grid])
  return createElement("div", { ref: host, className, style })
}

/**
 * A slot that hands back JSX. `10_render.ts` drops a React element on purpose: `Renderable` matches
 * one structurally through `$$typeof`, and the DOM path has no renderer to mount it with.
 *
 * This wraps the element in its own root and returns the `{ content, unsubscribe }` shape the slot
 * contract already carries, so the root unmounts with the row that mounted it.
 */
export function reactSlot<Ctx>(view: (ctx: Ctx) => ReactNode): Slot<Ctx> {
  return (ctx: Ctx): SlotContent => {
    const host = document.createElement("div")
    host.className = "sg-react"
    const root = createRoot(host)
    root.render(view(ctx) as ReactNode)
    // Unmounting inside React's own commit throws, and a row teardown can run in one.
    const unsubscribe = (): void => queueMicrotask(() => root.unmount())
    return { content: host as Renderable, unsubscribe }
  }
}
