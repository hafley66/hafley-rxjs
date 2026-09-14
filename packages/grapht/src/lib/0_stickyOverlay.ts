import { hoverOpacity } from "../2_graph/16_neighborhood.js"
import { GRAPH_STYLES, graphStyleOf, graphHoverColor, type GraphStyle, type GraphStyleInput } from "./0_graphStyle.js"
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

type StickyEntry = { group: SVGGElement; rect: SVGRectElement; text: SVGTextElement; button?: SVGGElement; icon?: SVGTextElement }

/** Input sinks share logical graph IDs with the underlying renderer. */
export type StickyInteractions = {
  focusInput$?: { next(ids: ReadonlySet<string>): void }
  collapseInput$?: { next(id: string): void }
}

export function createStickyOverlay(host: HTMLElement, sticky: StickyOptions = {}, interactions?: StickyInteractions) {
  let camera: GraphCamera | undefined
  let ribbonItems: RibbonItem[] = []
  let ribbonLabels: Record<string, string> = {}
  let groupHeaders: GroupHeader[] = []
  let groupBounds: Record<string, { x: number; width: number }> = {}
  let groupGraph: GraphFrame["graph"] = {}
  let collapsedIds: ReadonlySet<string> = new Set()
  const collapsedBottomOffsetById = new Map<string, number>()
  let currentHops: Readonly<Record<string, number>> = {}
  let overlay: SVGSVGElement | undefined
  let ribbonLayer: SVGGElement | undefined
  let groupLayer: SVGGElement | undefined
  const painted = new Map<string, StickyEntry>()
  const paintedGroups = new Map<string, StickyEntry>()

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
    store: Map<string, StickyEntry>,
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
    group.style.pointerEvents = "auto"
    group.addEventListener("pointerenter", () => interactions?.focusInput$?.next(new Set([id])))
    group.addEventListener("pointerleave", () => interactions?.focusInput$?.next(new Set()))
    group.addEventListener("pointerover", event => event.stopPropagation())
    group.addEventListener("pointerdown", event => event.stopPropagation())
    const rect = document.createElementNS(SVG_NAMESPACE, "rect")
    rect.setAttribute("rx", "4")
    rect.setAttribute("fill", token.fill)
    rect.setAttribute("stroke", token.stroke)
    const text = document.createElementNS(SVG_NAMESPACE, "text")
    text.setAttribute("fill", token.text)
    text.setAttribute("style", "font:12px ui-monospace,Menlo,monospace")
    group.append(rect, text)
    layer.appendChild(group)
    const entry: StickyEntry = { group, rect, text }
    if (role === "group" && interactions?.collapseInput$) {
      const button = document.createElementNS(SVG_NAMESPACE, "g")
      button.dataset.stickyCollapse = id
      button.setAttribute("role", "button"); button.setAttribute("tabindex", "0")
      button.style.cursor = "pointer"
      const hit = document.createElementNS(SVG_NAMESPACE, "rect")
      hit.setAttribute("width", "22"); hit.setAttribute("height", String(headerHeight)); hit.setAttribute("fill", "transparent")
      const icon = document.createElementNS(SVG_NAMESPACE, "text")
      icon.setAttribute("x", "5"); icon.setAttribute("y", String(headerHeight - 7)); icon.setAttribute("fill", token.text)
      icon.style.font = "bold 14px monospace"
      button.append(hit, icon); group.appendChild(button)
      button.addEventListener("click", event => { event.stopPropagation(); interactions.collapseInput$!.next(id) })
      button.addEventListener("keydown", event => {
        if (event.key !== "Enter" && event.key !== " ") return
        event.preventDefault(); event.stopPropagation(); interactions.collapseInput$!.next(id)
      })
      entry.button = button; entry.icon = icon
    }
    store.set(id, entry)
    return entry
  }

  const recolor = (
    store: Map<string, StickyEntry>,
    role: "ribbon" | "group",
  ): void => {
    const token = theme[role]
    for (const entry of store.values()) {
      entry.rect.setAttribute("fill", token.fill)
      entry.rect.setAttribute("stroke", token.stroke)
      entry.text.setAttribute("fill", token.text)
      entry.icon?.setAttribute("fill", token.text)
    }
  }

  const applyTheme = (next: GraphStyleInput): void => {
    theme = graphStyleOf(next)
    recolor(painted, "ribbon")
    recolor(paintedGroups, "group")
    applyHover(currentHops)
  }

  const sweep = (
    store: Map<string, StickyEntry>,
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
      headers: groupHeaders.map(header => ({ ...header, height: headerHeight / next.scale,
        boundaryBottom: Math.max(header.boundaryBottom, header.naturalTop + (collapsedBottomOffsetById.get(header.id) ?? -Infinity)),
      })),
      camera: next,
      inset: top,
      gap,
    })
    const live = new Set<string>()
    const occupied: { left: number; right: number; bottom: number }[] = []
    for (const placement of [...placements].sort((a, b) => a.top - b.top || a.depth - b.depth)) {
      if (!placement.visible) continue
      const bounds = groupBounds[placement.id]
      if (bounds === undefined) continue
      const bottomEdge = next.viewport.y + next.viewport.height - headerHeight
      if (placement.top < next.viewport.y || placement.top > bottomEdge) continue
      if (placement.state === "stuck" && placement.top < top) continue
      const left = Math.max(next.viewport.x + inset, bounds.x * next.scale + next.x)
      const right = Math.min(next.viewport.x + next.viewport.width - inset, (bounds.x + bounds.width) * next.scale + next.x)
      // Source headers can be only a few screen pixels apart at fitted zoom.
      // Pack overlapping horizontal spans into readable rows with reachable controls.
      let paintedTop = placement.top
      for (const row of occupied) if (left < row.right && right > row.left && paintedTop < row.bottom + gap) paintedTop = row.bottom + gap
      if (paintedTop > bottomEdge) continue
      occupied.push({ left, right, bottom: paintedTop + headerHeight })
      live.add(placement.id)
      const entry = upsert(paintedGroups, layer, placement.id, "group")
      entry.group.setAttribute("data-state", placement.state)
      entry.rect.setAttribute("x", String(left))
      entry.rect.setAttribute("y", String(paintedTop))
      entry.rect.setAttribute("width", String(Math.max(0, right - left)))
      entry.rect.setAttribute("height", String(headerHeight))
      entry.text.setAttribute("x", String(left + (entry.button ? 24 : 5)))
      if (entry.button && entry.icon) {
        entry.button.setAttribute("transform", `translate(${left},${paintedTop})`)
        entry.button.setAttribute("aria-expanded", String(!collapsedIds.has(placement.id)))
        entry.button.setAttribute("aria-label", `${collapsedIds.has(placement.id) ? "Expand" : "Collapse"} ${ribbonLabels[placement.id] ?? placement.id}`)
        entry.icon.textContent = collapsedIds.has(placement.id) ? "+" : "−"
      }
      entry.text.setAttribute("y", String(paintedTop + headerHeight - 7))
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

  const applyHover = (hops: Readonly<Record<string, number>>): void => {
    currentHops = hops
    const active = Object.keys(hops).length > 0
    for (const [store, role] of [[painted, "ribbon"], [paintedGroups, "group"]] as const) {
      for (const [id, entry] of store) {
        const color = hops[id] === undefined ? undefined : graphHoverColor(theme, hops[id])
        entry.group.style.opacity = String(hoverOpacity(hops[id], active))
        entry.rect.setAttribute("stroke", color ?? theme[role].stroke)
        entry.text.setAttribute("fill", color ?? theme[role].text)
        entry.icon?.setAttribute("fill", color ?? theme[role].text)
      }
    }
  }

  const applyCamera = (next: GraphCamera): void => {
    camera = next
    paintGroups(next)
    paintRibbon(next)
    applyHover(currentHops)
  }
  return {
    render(frame: GraphFrame) {
      const nextCollapsed = frame.presentation.collapsedIds ?? new Set()
      // Keep a clicked header reachable after its content contracts above the sticky slot.
      // Store an offset from the group so later collapses reflow this boundary with its geometry.
      for (const id of nextCollapsed) if (!collapsedIds.has(id)) {
        const entry = paintedGroups.get(id)
        const previous = groupHeaders.find(header => header.id === id)
        if (entry && camera && previous) collapsedBottomOffsetById.set(id, (Number(entry.rect.getAttribute("y")) + headerHeight - camera.y) / camera.scale - previous.naturalTop)
      }
      for (const id of collapsedBottomOffsetById.keys()) if (!nextCollapsed.has(id)) collapsedBottomOffsetById.delete(id)
      collapsedIds = nextCollapsed
      currentHops = frame.presentation.hopsById ?? currentHops
      const columns = frame.geometry.columnBoundsById ?? {}
      ribbonItems = Object.entries(columns)
        .filter(([id]) => !frame.presentation.hiddenIds.has(id))
        .map(([id, bounds], index) => ({ id, left: bounds.x, width: bounds.width, top: bounds.y, bottom: bounds.y + bounds.height, order: index }))
        .sort((left, right) => left.left - right.left)
        .map((item, order) => ({ ...item, order }))
      ribbonLabels = Object.fromEntries(Object.entries(frame.presentation.labelsById).map(([id, label]) => [id, label.text]))
      groupGraph = frame.graph
      groupBounds = Object.fromEntries(
        Object.entries(frame.geometry.headerBoundsById).map(([id, header]) => [id, { x: header.x, width: header.width }]),
      )
      groupHeaders = Object.entries(frame.geometry.headerBoundsById)
        .filter(([id]) => !frame.presentation.hiddenIds.has(id))
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
    applyHover,
    applySticky,
    applyTheme,
    unsubscribe() {
      overlay?.remove()
      painted.clear()
      paintedGroups.clear()
      collapsedBottomOffsetById.clear()
      collapsedIds = new Set()
      currentHops = {}
      camera = undefined
    },
  }
}
