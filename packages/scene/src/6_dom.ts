import type { Frame, Id, Item, Renderer } from "./0_types"
import { indexOf } from "./2_geometry"
import { renderer } from "./4_renderer"

export type DomRendererOptions = {
  /** Class on each item element; `data-id` and `data-kind` are always set. */
  className?: string
  /** `attrs.html` of items with this `kind` becomes innerHTML; other kinds get an empty element. */
  cardKind?: string
  edgeStroke?: string
  edgeWidth?: number
}

type State = {
  layer: HTMLElement
  svg: SVGSVGElement
  views: Map<Id, HTMLElement>
  slots: HTMLElement[]
  slotIds: readonly Id[] | null
  pool: HTMLElement[]
  lines: SVGLineElement[]
  options: Required<DomRendererOptions>
}

const SVG_NS = "http://www.w3.org/2000/svg"

const DEFAULTS: Required<DomRendererOptions> = {
  className: "scene-item",
  cardKind: "card",
  edgeStroke: "#2a3a55",
  edgeWidth: 1.5,
}

function subscribe(host: HTMLElement, options: Required<DomRendererOptions>): State {
  const svg = document.createElementNS(SVG_NS, "svg")
  svg.setAttribute(
    "style",
    "position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;pointer-events:none",
  )
  const layer = document.createElement("div")
  layer.setAttribute("style", "position:absolute;left:0;top:0;width:0;height:0")
  host.appendChild(svg)
  host.appendChild(layer)
  return { layer, svg, views: new Map(), slots: [], slotIds: null, pool: [], lines: [], options }
}

function enter(state: State, item: Item): HTMLElement {
  const el = state.pool.pop() ?? document.createElement("div")
  el.className = state.options.className
  el.dataset.id = item.id
  el.dataset.kind = item.kind
  el.style.position = "absolute"
  el.style.willChange = "transform"
  el.innerHTML = item.kind === state.options.cardKind ? String(item.attrs?.html ?? item.id) : ""
  state.layer.appendChild(el)
  return el
}

function exit(state: State, el: HTMLElement): void {
  el.remove()
  state.pool.push(el)
}

function next(state: State, { scene, geometry, diff }: Frame): void {
  for (const id of diff.exit) {
    const el = state.views.get(id)
    if (el) {
      exit(state, el)
      state.views.delete(id)
    }
  }
  const { ids, pos } = geometry
  if (state.slotIds !== ids || diff.exit.length) {
    state.slots.length = ids.length
    for (let i = 0; i < ids.length; i++) {
      let el = state.views.get(ids[i])
      if (!el) {
        const item = scene.items.get(ids[i])
        if (!item) continue
        el = enter(state, item)
        state.views.set(ids[i], el)
      }
      state.slots[i] = el
    }
    state.slotIds = ids
  }
  const slots = state.slots
  for (let i = 0; i < slots.length; i++) {
    const el = slots[i]
    if (el) el.style.transform = `translate(${pos[2 * i]}px, ${pos[2 * i + 1]}px)`
  }
  const index = indexOf(geometry)
  let n = 0
  for (const [a, b] of scene.edges.values()) {
    const i = index.get(a)
    const j = index.get(b)
    if (i === undefined || j === undefined) continue
    let line = state.lines[n]
    if (!line) {
      line = document.createElementNS(SVG_NS, "line")
      line.setAttribute("stroke", state.options.edgeStroke)
      line.setAttribute("stroke-width", String(state.options.edgeWidth))
      state.svg.appendChild(line)
      state.lines[n] = line
    }
    line.setAttribute("x1", String(pos[2 * i]))
    line.setAttribute("y1", String(pos[2 * i + 1]))
    line.setAttribute("x2", String(pos[2 * j]))
    line.setAttribute("y2", String(pos[2 * j + 1]))
    n++
  }
  for (let k = n; k < state.lines.length; k++) state.lines[k].remove()
  state.lines.length = n
}

function unsubscribe(state: State): void {
  state.layer.remove()
  state.svg.remove()
  state.views.clear()
  state.pool.length = 0
  state.lines.length = 0
}

/** Plain-DOM renderer: one absolutely positioned element per id moved by `transform`, edges as SVG lines. */
export function dom(options: DomRendererOptions = {}): Renderer {
  const resolved = { ...DEFAULTS, ...options }
  return renderer<State>({ subscribe: host => subscribe(host, resolved), next, unsubscribe })
}
