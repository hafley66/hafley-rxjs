// Alt-click is the whole-branch modifier: one intent writes one `expanded` map covering every
// descendant, so a 261-node subtree opens in a single change rather than 261 of them.
import { fromEvent, Subscription, tap, timer } from "rxjs"
import { mountInView, runWhenInView } from "@hafley66/docs-kit"
import { grid, render, type ColumnDef } from "../src/index.js"
import source from "./26_deep_tree.ts?raw"
import type { Example } from "./0_types.js"

interface Node {
  readonly id: string
  readonly name: string
  readonly depth: number
  readonly size: number
  readonly children?: readonly Node[]
}

const FANOUT: readonly number[] = [5, 4, 4, 3, 4]

const buildLevel = (prefix: string, depth: number): readonly Node[] => {
  const width = FANOUT[depth] ?? 0
  return Array.from({ length: width }, (_, index) => {
    const id = `${prefix}-${depth}.${index}`
    const children = depth + 1 < FANOUT.length ? buildLevel(id, depth + 1) : undefined
    return {
      id,
      name: `${"node".padStart(depth * 2 + 4, " ")} ${depth}.${index}`,
      depth,
      size: (index + 1) * (depth + 1) * 97,
      children,
    }
  })
}

const TREE: readonly Node[] = buildLevel("n", 0)

const countOf = (nodes: readonly Node[]): number =>
  nodes.reduce((sum, it) => sum + 1 + countOf(it.children ?? []), 0)

const TOTAL = countOf(TREE)

const COLUMNS: readonly ColumnDef<Node>[] = [
  { id: "name", header: "Node", flex: 2, minWidth: 240 },
  { id: "depth", header: "Depth", width: 90, type: "number" },
  { id: "size", header: "Size", width: 110, type: "number" },
]

export const deepTree: Example = {
  id: "stress-deep-tree",
  title: "Five levels, one branch at a time",
  summary:
    "A 1,305-node forest five levels deep; the button alt-clicks the first expander, which opens that entire branch in one state write and re-flattens the forest under it.",
  feature: "row.expand",
  source,
  mount: (host) => mountInView(host, () => {
    const box = document.createElement("div")
    const open = document.createElement("button")
    open.type = "button"
    open.textContent = "alt-click the first branch"
    const label = document.createElement("code")
    const root = document.createElement("div")
    root.style.blockSize = "360px"
    box.append(open, label, root)
    host.append(box)
    const g = grid<Node>({
      id: "stress-deep-tree",
      rows: TREE,
      columns: COLUMNS,
      rowId: (it) => it.id,
      subRows: (it) => it.children,
    })
    const handle = render(g, root)
    const subs = new Subscription()
    subs.add(runWhenInView(g.view.flat.$.pipe(tap((it) => {
      label.textContent = `${TOTAL} nodes in the forest, ${it.length} flattened`
    }))))
    const altClick = (): void => {
      const expander = root.querySelector(".sg-expander")
      if (expander instanceof HTMLElement) {
        expander.dispatchEvent(new MouseEvent("click", { bubbles: true, altKey: true, button: 0 }))
      }
    }
    const clicked$ = fromEvent(open, "click")
    subs.add(runWhenInView(clicked$.pipe(tap(altClick))))
    subs.add(runWhenInView(timer(120).pipe(tap(altClick))))
    return () => {
      subs.unsubscribe()
      handle.stop()
      g.close()
      box.remove()
    }
  }),
}
