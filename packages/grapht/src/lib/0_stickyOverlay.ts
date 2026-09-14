import { GRAPH_STYLES, graphStyleOf, type GraphStyle, type GraphStyleInput } from "./0_graphStyle.js"
// Shared screen-space actor and group headers for document and Cytoscape views.
import { layoutStickyRibbon, type RibbonItem } from "@hafley66/grapht-model"
import { stackGroupHeaders, type GroupHeader } from "../2_graph/6_stackGroupHeaders.js"
import type { GraphCamera, GraphFrame } from "../2_graph/0_frame.js"

export type StickyOptions = {
  inset?: number
  fullWidth?: number
  chipWidth?: number
  gap?: number
  height?: number
  ribbon?: boolean
  groups?: boolean
}

export type { GraphTheme } from "./0_graphStyle.js"

const SVG_NAMESPACE = "http://www.w3.org/2000/svg"

/** A condensed header has room for a mark, not a name: one letter per word, three at most. */
function initialsOf(label: string): string {
  const letters = label
    .split(/\s+/)
    .filter(word => word.length > 0)
    .map(word => word[0]?.toUpperCase() ?? "")
    .join("")
  return letters.slice(0, 3) || label.slice(0, 2).toUpperCase()
}

export function createStickyOverlay(host: HTMLElement, sticky: StickyOptions = {}) {
  let camera: GraphCamera | undefined
  let ribbonItems: RibbonItem[] = []
  let ribbonLabels: Record<string, string> = {}
  let groupHeaders: GroupHeader[] = []
  let groupBounds: Record<string, { x: number; width: number }> = {}
  let groupGraph: GraphFrame["graph"] = {}
  let overlay: SVGSVGElement | undefined
  let ribbonLayer: SVGGElement | undefined
  let groupLayer: SVGGElement | undefined
  const painted = new Map<string, { group: SVGGElement; rect: SVGRectElement; text: SVGTextElement }>()
  const paintedGroups = new Map<string, { group: SVGGElement; rect: SVGRectElement; text: SVGTextElement }>()

  let wantsRibbon = sticky.ribbon ?? true
  let wantsGroups = sticky.groups ?? true
  let theme: GraphStyle = GRAPH_STYLES.light
  const inset = sticky.inset ?? 8
  const fullWidth = sticky.fullWidth ?? 60
  const chipWidth = sticky.chipWidth ?? 32
  const gap = sticky.gap ?? 4
  const headerHeight = sticky.height ?? 22

  const ensureOverlay = (): { ribbon: SVGGElement; groups: SVGGElement } => {
    const document = host.ownerDocument
    if (overlay === undefined) {
      if (getComputedStyle(host).position === "static") host.style.position = "relative"
      const element = document.createElementNS(SVG_NAMESPACE, "svg")
      element.setAttribute("style", "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;overflow:visible")
      groupLayer = document.createElementNS(SVG_NAMESPACE, "g")
      groupLayer.setAttribute("data-sticky-groups", "")
      ribbonLayer = document.createElementNS(SVG_NAMESPACE, "g")
      ribbonLayer.setAttribute("data-sticky-ribbon", "")
      element.append(groupLayer, ribbonLayer)
      host.appendChild(element)
      overlay = element
    }
    return { ribbon: ribbonLayer as SVGGElement, groups: groupLayer as SVGGElement }
  }

  const upsert = (
    store: Map<string, { group: SVGGElement; rect: SVGRectElement; text: SVGTextElement }>,
    layer: SVGGElement,
    id: string,
    role: "ribbon" | "group",
  ) => {
    const existing = store.get(id)
    if (existing !== undefined) return existing
    const token = theme[role]
    const document = host.ownerDocument
    const group = document.createElementNS(SVG_NAMESPACE, "g")
    group.setAttribute("data-sticky-id", id)
    const rect = document.createElementNS(SVG_NAMESPACE, "rect")
    rect.setAttribute("rx", "4")
    rect.setAttribute("fill", token.fill)
    rect.setAttribute("stroke", token.stroke)
    const text = document.createElementNS(SVG_NAMESPACE, "text")
    text.setAttribute("fill", token.text)
    text.setAttribute("style", "font:12px ui-monospace,Menlo,monospace")
    group.append(rect, text)
    layer.appendChild(group)
    const entry = { group, rect, text }
    store.set(id, entry)
    return entry
  }

  const recolor = (
    store: Map<string, { group: SVGGElement; rect: SVGRectElement; text: SVGTextElement }>,
    role: "ribbon" | "group",
  ): void => {
    const token = theme[role]
    for (const entry of store.values()) {
      entry.rect.setAttribute("fill", token.fill)
      entry.rect.setAttribute("stroke", token.stroke)
      entry.text.setAttribute("fill", token.text)
    }
  }

  const applyTheme = (next: GraphStyleInput): void => {
    theme = graphStyleOf(next)
    recolor(painted, "ribbon")
    recolor(paintedGroups, "group")
  }

  const sweep = (
    store: Map<string, { group: SVGGElement; rect: SVGRectElement; text: SVGTextElement }>,
    live: ReadonlySet<string>,
  ): void => {
    for (const [id, entry] of store) {
      if (live.has(id)) continue
      entry.group.remove()
      store.delete(id)
    }
  }

  const paintGroups = (next: GraphCamera): void => {
    if (!wantsGroups || groupHeaders.length === 0) return
    const layer = ensureOverlay().groups
    // Heights go in pre-divided by the camera scale, so a stacked slot is the same
    // screen height at any zoom and the bars stay readable.
    // The ribbon owns the first row, so the group stack starts under it.
    const top = inset + (wantsRibbon && ribbonItems.length > 0 ? headerHeight + gap : 0)
    const placements = stackGroupHeaders({
      graph: groupGraph,
      headers: groupHeaders.map(header => ({ ...header, height: headerHeight / next.scale })),
      camera: next,
      inset: top,
      gap,
    })
    const live = new Set<string>()
    for (const placement of placements) {
      if (!placement.visible) continue
      const bounds = groupBounds[placement.id]
      if (bounds === undefined) continue
      const bottomEdge = next.viewport.y + next.viewport.height - headerHeight
      if (placement.top < next.viewport.y || placement.top > bottomEdge) continue
      if (placement.state === "stuck" && placement.top < top) continue
      live.add(placement.id)
      const entry = upsert(paintedGroups, layer, placement.id, "group")
      const left = Math.max(next.viewport.x + inset, bounds.x * next.scale + next.x)
      const right = Math.min(next.viewport.x + next.viewport.width - inset, (bounds.x + bounds.width) * next.scale + next.x)
      entry.group.setAttribute("data-state", placement.state)
      entry.rect.setAttribute("x", String(left))
      entry.rect.setAttribute("y", String(placement.top))
      entry.rect.setAttribute("width", String(Math.max(0, right - left)))
      entry.rect.setAttribute("height", String(headerHeight))
      entry.text.setAttribute("x", String(left + 5))
      entry.text.setAttribute("y", String(placement.top + headerHeight - 7))
      entry.text.textContent = ribbonLabels[placement.id] ?? placement.id
    }
    sweep(paintedGroups, live)
  }

  const paintRibbon = (next: GraphCamera): void => {
    if (!wantsRibbon || ribbonItems.length === 0) return
    const layer = ensureOverlay().ribbon
    const document = host.ownerDocument
    const placements = layoutStickyRibbon({
      items: ribbonItems,
      camera: { x: next.x, y: next.y, scale: next.scale },
      viewport: next.viewport,
      inset,
      fullWidth,
      chipWidth,
      gap,
    })
    const live = new Set<string>()
    for (const placement of placements) {
      if (placement.state === "released") continue
      live.add(placement.id)
      const label = ribbonLabels[placement.id] ?? placement.id
      const entry = upsert(painted, layer, placement.id, "ribbon")
      entry.group.setAttribute("data-detail", placement.detail)
      entry.rect.setAttribute("x", String(placement.left))
      entry.rect.setAttribute("y", String(placement.top))
      entry.rect.setAttribute("width", String(placement.width))
      entry.rect.setAttribute("height", String(headerHeight))
      entry.text.setAttribute("x", String(placement.left + 5))
      entry.text.setAttribute("y", String(placement.top + headerHeight - 7))
      entry.text.textContent = placement.detail === "chip" ? initialsOf(label) : label
    }
    sweep(painted, live)
  }

  const applySticky = (next: Pick<StickyOptions, "ribbon" | "groups">): void => {
    wantsRibbon = next.ribbon ?? wantsRibbon
    wantsGroups = next.groups ?? wantsGroups
    if (!wantsRibbon) sweep(painted, new Set())
    if (!wantsGroups) sweep(paintedGroups, new Set())
    if (camera !== undefined) applyCamera(camera)
  }

  const applyCamera = (next: GraphCamera): void => {
    camera = next
    paintGroups(next)
    paintRibbon(next)
  }
  return {
    render(frame: GraphFrame) {
      const columns = frame.geometry.columnBoundsById ?? {}
      ribbonItems = Object.entries(columns)
        .map(([id, bounds], index) => ({ id, left: bounds.x, width: bounds.width, top: bounds.y, bottom: bounds.y + bounds.height, order: index }))
        .sort((left, right) => left.left - right.left)
        .map((item, order) => ({ ...item, order }))
      ribbonLabels = Object.fromEntries(Object.entries(frame.presentation.labelsById).map(([id, label]) => [id, label.text]))
      groupGraph = frame.graph
      groupBounds = Object.fromEntries(
        Object.entries(frame.geometry.headerBoundsById).map(([id, header]) => [id, { x: header.x, width: header.width }]),
      )
      groupHeaders = Object.entries(frame.geometry.headerBoundsById)
        .map(([id, header]) => ({
          id,
          naturalTop: header.y,
          boundaryBottom: (frame.geometry.boundsById[id]?.y ?? header.y) + (frame.geometry.boundsById[id]?.height ?? header.height),
          height: header.height,
          order: header.y,
        }))
        .sort((left, right) => left.naturalTop - right.naturalTop)
      if (ribbonItems.length === 0) sweep(painted, new Set())
      if (groupHeaders.length === 0) sweep(paintedGroups, new Set())
      applyCamera(frame.camera)
      // Keep headers above replacement artifacts and canvas layers.
      if (overlay) host.appendChild(overlay)
    },
    applyCamera,
    applySticky,
    applyTheme,
    unsubscribe() {
      overlay?.remove()
      painted.clear()
      paintedGroups.clear()
      camera = undefined
    },
  }
}
