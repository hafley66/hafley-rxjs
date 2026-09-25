// React mounts the box. The grid owns every node inside it, because the scroll matrix in
// `bench/README.md` puts the package at 17% of a frame at its breaking point and reconciling
// 8,915 cell nodes per scroll would spend the other 83% twice.
import { createElement, useEffect, useRef, type CSSProperties, type ReactElement, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { flushSync } from "react-dom"
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
export interface ReactSlotOptions {
  /**
   * Commit the cell inside the frame that asked for it. A concurrent root schedules the commit off
   * the animation frame, and a grid that never yields one leaves the cells empty for as long as it
   * moves: `bench/scroll/chaos.html` counts 0 filled of 416 without this.
   *
   * `flushSync` is a no-op while React is already rendering, which is where the initial mount runs,
   * so the first commit still lands on React's own schedule.
   */
  readonly sync?: boolean
  /**
   * How many `{ host, root }` pairs to keep for reuse when a cell leaves. A scroll retires every
   * rendered cell each frame, so without a pool the page builds and tears down a root per cell per
   * frame. 0 turns pooling off.
   */
  readonly pool?: number
}

interface Pair {
  readonly host: HTMLElement
  readonly root: Root
}

export function reactSlot<Ctx>(view: (ctx: Ctx) => ReactNode, options?: ReactSlotOptions): Slot<Ctx> {
  const sync = options?.sync ?? true
  const cap = options?.pool ?? 256
  const free: Pair[] = []
  const make = (): Pair => {
    const host = document.createElement("div")
    host.className = "sg-react"
    return { host, root: createRoot(host) }
  }
  return (ctx: Ctx): SlotContent => {
    const pair = free.pop() ?? make()
    const draw = (): void => pair.root.render(view(ctx) as ReactNode)
    if (sync) flushSync(draw)
    else draw()
    const unsubscribe = (): void => {
      // Unmounting inside React's own commit throws, and a row teardown can run in one. A pooled
      // pair keeps its root and takes the next cell's content instead of being rebuilt.
      if (free.length < cap) {
        pair.host.remove()
        free.push(pair)
        return
      }
      queueMicrotask(() => pair.root.unmount())
    }
    return { content: pair.host as Renderable, unsubscribe }
  }
}

export type { Root }

export { TreeView, FsTreeView, type TreeViewProps, type FsTreeViewProps } from "./1_TreeView.js"
