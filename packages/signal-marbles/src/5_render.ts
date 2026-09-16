// The surface. Framework-free on purpose: `renderMarbles` decorates an element and returns its
// teardown, which is exactly an effect's contract, so the React adapter is the effect and nothing
// else.
//
// The subscriptions this package makes live here, because a renderer IS a boundary — it owns native
// nodes and has to release them. `unsubscribe()` is that release, so a caller that never calls it
// has a leak it can name, which is the whole point of the rule.
//
// What a reader gets, in order of how much it matters:
//   1. columns are causal turns, and the width between two of them is the time between them
//   2. a marble carries a name (`lane#n`), a value, and the reason it happened
//   3. an edge is drawn from the event that caused an event or a subscription to the thing it caused
//   4. a column readout says, in words, what is happening on the column the reveal is standing on
import { combineLatest, type Subscription, skip } from "rxjs"
import {
  AXIS_PAD,
  AXIS_PITCH,
  describeLane,
  describeMarbleDoc,
  describeNotification,
  frameAtTick,
  laneDepth,
  type MarbleAxis,
  type MarbleBirth,
  type MarbleDoc,
  type MarbleEdge,
  type MarbleNotification,
  marbleAxis,
  marbleColumnCount,
  marbleEdges,
  marbleTracks,
} from "./0_types.js"
import type { MarbleLaneView, MarblePlayer } from "./4_player.js"

const GUTTER = 168
const BASE_ROW = 34
const NOTE_ROOM = 30
const STACK_STEP = 13
const HOVER_PX = 12
const MAX_NOTE_CHARS = 34

export type MarbleRender = { unsubscribe: () => void }

type State = "hidden" | "shown" | "current"

type Placed = {
  node: HTMLElement
  lane: string
  notification: MarbleNotification
  /** Position within the lanes box, for the edge overlay. Valid after `layout`. */
  x: number
  y: number
}

type StripEntry = { lane: string; strip: HTMLElement; row: HTMLElement; view: MarbleLaneView }

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

/** How many marbles share a column anywhere in this lane, which is how tall the lane has to be. */
function laneHeight(view: MarbleLaneView): number {
  const perColumn = new Map<number, number>()
  for (const notification of view.lane.notifications) {
    perColumn.set(notification.tick, (perColumn.get(notification.tick) ?? 0) + 1)
  }
  let deepest = 1
  for (const count of perColumn.values()) deepest = Math.max(deepest, count)
  const notes = view.lane.notifications.some(notification => notification.note !== undefined)
  return BASE_ROW + (deepest - 1) * STACK_STEP + (notes || view.lane.born !== null ? NOTE_ROOM : 0)
}

function marbleNode(notification: MarbleNotification): HTMLElement {
  const node = el("span", "mb-marble")
  node.dataset.kind = notification.kind
  node.dataset.marble = notification.id
  // The column, on the node: a geometry test can then ask the document and the DOM the same question.
  node.dataset.tick = String(notification.tick)
  switch (notification.kind) {
    case "next":
    case "error":
      node.append(el("span", "mb-dot"))
      if (notification.value !== undefined) node.append(el("span", "mb-value", notification.value))
      break
    case "complete":
      node.append(el("span", "mb-bar"))
      break
    case "subscribe":
      node.append(el("span", "mb-caret"))
      break
    case "unsubscribe":
      node.append(el("span", "mb-caret"))
      break
    case "truncate":
      node.append(el("span", "mb-cut"))
      break
  }
  if (notification.note !== undefined) {
    const short =
      notification.note.length > MAX_NOTE_CHARS
        ? `${notification.note.slice(0, MAX_NOTE_CHARS - 1)}…`
        : notification.note
    const note = el("span", "mb-note", short)
    note.title = notification.note
    node.append(note)
  }
  return node
}

/** A short word for a notification, used by the column readout. */
function sayKind(notification: MarbleNotification): string {
  switch (notification.kind) {
    case "next":
      return "value"
    case "error":
      return "error"
    case "complete":
      return "complete"
    case "subscribe":
      return "subscribe"
    case "unsubscribe":
      return "unsubscribe"
    case "truncate":
      return "cut"
  }
}

export function renderMarbles(player: MarblePlayer, host: HTMLElement): MarbleRender {
  const root = el("div", "mb-root")
  root.setAttribute("role", "group")
  // One number decides the gutter: the renderer measures strips against it, and a host that
  // overrides the variable moves them together.
  root.style.setProperty("--mb-gutter", `${GUTTER}px`)

  const head = el("div", "mb-head")
  const title = el("div", "mb-title")
  const controls = el("div", "mb-controls")
  const stepBack = el("button", "mb-control", "\u2039")
  const toggle = el("button", "mb-control", "play")
  const stepForward = el("button", "mb-control", "\u203a")
  const showAll = el("button", "mb-control", "all")
  const readout = el("span", "mb-readout", "")
  stepBack.dataset.act = "step-back"
  toggle.dataset.act = "toggle"
  stepForward.dataset.act = "step-forward"
  showAll.dataset.act = "all"
  controls.append(stepBack, toggle, stepForward, showAll)
  // The readout is a sibling of the controls, not a member of them: a row of buttons that ends in a
  // text box is a row that moves whenever the text does, and this text is a column count and a
  // duration — both of which change on every step. To the left of the buttons its growth is spent
  // on the title's slack instead of on the position of the controls.
  head.append(title, readout, controls)

  const panel = el("div", "mb-panel")
  const panelHead = el("div", "mb-panel-head")
  const panelBody = el("ul", "mb-panel-body")
  panel.append(panelHead, panelBody)

  const scroll = el("div", "mb-scroll")
  const lanes = el("div", "mb-lanes")
  const edges = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  edges.setAttribute("class", "mb-edges")
  edges.setAttribute("aria-hidden", "true")
  lanes.append(edges)
  // The axis starts where every strip starts, because its leading box is the same box the lane
  // gutters are: one rule, one width, no margin arithmetic to drift by a padding box.
  const axisRow = el("div", "mb-axis-row")
  const axisGutter = el("div", "mb-axis-gutter")
  const axis = el("div", "mb-axis")
  axisRow.append(axisGutter, axis)
  scroll.append(lanes, axisRow)

  const documentBox = el("details", "mb-document")
  documentBox.append(el("summary", "mb-document-summary", "document"))
  const documentText = el("pre", "mb-document-text")
  documentBox.append(documentText)

  /**
   * The key. A caret is not self-explanatory, and a reader should not have to hover seven marbles to
   * learn that a caret pointing up is a subscription starting and one pointing down is it stopping.
   */
  const legend = el("div", "mb-legend")
  const legendItem = (kind: string | null, shape: string, label: string): void => {
    const item = el("span", "mb-legend-item")
    if (kind !== null) item.dataset.kind = kind
    const glyph = el("span", "mb-legend-glyph")
    if (shape === "edge") glyph.append(el("span", "mb-edge-swatch"))
    else if (shape === "break") glyph.append(el("span", "mb-break-swatch"))
    else glyph.append(el("span", `mb-${shape}`))
    item.append(glyph, el("span", "mb-legend-label", label))
    legend.append(item)
  }
  legendItem("next", "dot", "value")
  legendItem("error", "dot", "error")
  legendItem("complete", "bar", "complete")
  legendItem("subscribe", "caret", "subscribed")
  legendItem("unsubscribe", "caret", "unsubscribed")
  legendItem("truncate", "cut", "window closed")
  legendItem(null, "break", "time the axis refused to draw")
  legendItem(null, "edge", "the event this came from")
  // The unit is stated once here rather than on every column: repeated, it is what pushed two
  // compressed labels into each other.
  const units = el("span", "mb-legend-item")
  units.append(el("span", "mb-legend-label", "axis: t = turn, number = ms"))
  legend.append(units)

  root.append(head, legend, panel, scroll, documentBox)
  host.replaceChildren(root)

  const live: Subscription[] = []
  let placed: Placed[] = []
  let strips: StripEntry[] = []
  let geometry: MarbleAxis = marbleAxis({ version: "marbles/2", columns: [0], lanes: [] })
  let byEvent = new Map<string, Placed>()
  let laneNodes = new Map<string, Placed>()
  let laneBirthTick = new Map<string, number>()
  let axisTicks = new Map<number, HTMLElement>()

  /** The grid line a column sits on: the pad, then one track per gap before it. */
  const columnLine = (tick: number): string => `${tick + 2} / span 1`

  const revealedTick = (revealed: number | "all"): number =>
    revealed === "all" ? marbleColumnCount(player.doc.$()) - 1 : revealed

  const stateOf = (tick: number, revealed: number | "all"): State => {
    if (revealed === "all") return tick === revealedTick("all") ? "current" : "shown"
    if (tick > revealed) return "hidden"
    return tick === revealed ? "current" : "shown"
  }

  const applyReveal = (revealed: number | "all"): void => {
    const doc = player.doc.$()
    const columns = marbleColumnCount(doc)
    const current = revealed === "all" ? null : revealed
    for (const entry of placed) {
      const state = stateOf(entry.notification.tick, revealed)
      if (entry.node.dataset.state !== state) entry.node.dataset.state = state
    }
    for (const path of edges.querySelectorAll<SVGPathElement>("path")) {
      const from = path.dataset.from
      const to = path.dataset.to
      const fromTick = from === undefined ? -1 : (byEvent.get(from)?.notification.tick ?? -1)
      // A birth edge's target is a lane, and a lane has a birth tick rather than an event.
      const toTick = to === undefined ? -1 : (byEvent.get(to)?.notification.tick ?? laneBirthTick.get(to) ?? -1)
      path.dataset.state = stateOf(Math.max(fromTick, toTick), revealed)
    }
    for (const [tick, node] of axisTicks) node.dataset.current = String(tick === current)
    readout.textContent =
      revealed === "all"
        ? `${columns} columns \u00b7 ${frameAtTick(doc, columns - 1)}ms`
        : `column ${revealed + 1} of ${columns} \u00b7 ${frameAtTick(doc, revealed)}ms`
    describeColumn(current)
  }

  /** The words for one column: every event on it, its name, its value, and its reason. */
  const describeColumn = (tick: number | null): void => {
    const doc = player.doc.$()
    const columns = marbleColumnCount(doc)
    panelBody.replaceChildren()
    if (tick === null) {
      panelHead.textContent = "every column revealed"
      const lanes = doc.lanes.length
      panelBody.append(
        el(
          "li",
          "mb-panel-empty",
          `${lanes} lane${lanes === 1 ? "" : "s"} \u00b7 step with \u2039 \u203a to walk the turns`,
        ),
      )
      return
    }
    const clamped = Math.min(Math.max(tick, 0), columns - 1)
    const events = doc.lanes.flatMap(lane =>
      lane.notifications
        .filter(notification => notification.tick === clamped)
        .map(notification => ({ lane, notification })),
    )
    panelHead.textContent = `column ${clamped + 1} at ${frameAtTick(doc, clamped)}ms`
    if (events.length === 0 && doc.lanes.every(lane => lane.born?.tick !== clamped)) {
      panelBody.append(el("li", "mb-panel-empty", "nothing happened on this turn"))
      return
    }
    // A lane that started on this column says so once: its `subscribe` marker and its birth record
    // are the same moment, and printing both reads as two events.
    const births = new Map(
      doc.lanes.filter(lane => lane.born?.tick === clamped).map(lane => [lane.id, lane.born as MarbleBirth]),
    )
    for (const { lane, notification } of events) {
      const born = births.get(lane.id)
      if (notification.kind === "subscribe" && born) {
        births.delete(lane.id)
        const item = el("li", "mb-panel-row")
        item.dataset.kind = "subscribe"
        item.append(el("span", "mb-panel-lane", lane.label))
        item.append(el("span", "mb-panel-kind", "starts"))
        if (born.cause !== undefined) item.append(el("span", "mb-panel-value", born.cause))
        if (born.seed !== undefined) item.append(el("span", "mb-panel-from", `seed ${born.seed}`))
        item.append(el("span", "mb-panel-name", notification.id))
        if (born.from !== null) item.append(el("span", "mb-panel-from", `from ${born.from}`))
        if (born.note !== undefined) item.append(el("span", "mb-panel-note", born.note))
        panelBody.append(item)
        continue
      }
      const item = el("li", "mb-panel-row")
      item.dataset.kind = notification.kind
      item.append(el("span", "mb-panel-lane", lane.label))
      item.append(el("span", "mb-panel-kind", sayKind(notification)))
      if (notification.value !== undefined) item.append(el("span", "mb-panel-value", notification.value))
      item.append(el("span", "mb-panel-name", notification.id))
      if (notification.from !== undefined) item.append(el("span", "mb-panel-from", `from ${notification.from}`))
      if (notification.note !== undefined) item.append(el("span", "mb-panel-note", notification.note))
      panelBody.append(item)
    }
    for (const [laneId, born] of births) {
      const lane = doc.lanes.find(it => it.id === laneId)
      if (lane === undefined) continue
      const item = el("li", "mb-panel-row")
      item.dataset.kind = "subscribe"
      item.append(el("span", "mb-panel-lane", lane.label))
      item.append(el("span", "mb-panel-kind", "starts"))
      if (born.cause !== undefined) item.append(el("span", "mb-panel-value", born.cause))
      item.append(el("span", "mb-panel-name", lane.id))
      if (born.seed !== undefined) item.append(el("span", "mb-panel-from", `seed ${born.seed}`))
      if (born.from !== null) item.append(el("span", "mb-panel-from", `from ${born.from}`))
      item.append(el("span", "mb-panel-note", `born t${born.tick}`))
      panelBody.append(item)
    }
  }

  /** Curves from the event that caused something to the thing it caused. */
  const drawEdges = (doc: MarbleDoc): void => {
    edges.replaceChildren()
    if (strips.length === 0) return
    edges.setAttribute("viewBox", `0 0 ${lanes.scrollWidth} ${lanes.scrollHeight}`)
    edges.style.width = `${lanes.scrollWidth}px`
    edges.style.height = `${lanes.scrollHeight}px`

    const route = (edge: MarbleEdge): void => {
      const source = byEvent.get(edge.from)
      if (!source) return
      const target = byEvent.get(edge.to) ?? laneNodes.get(edge.to)
      if (!target) return
      // Marble anchors are measured against the lanes container, so they are in the overlay's own
      // coordinates. Adding the gutter here — as this did — put every edge a gutter to the right of
      // the marble it came from, which is what the demo showed as ticks that do not line up.
      const x1 = source.x
      const y1 = source.y
      const x2 = target.x
      const y2 = target.y
      // A cubic that leaves the source vertically and arrives at the target vertically reads as a
      // dependency whether the two lanes are adjacent or far apart.
      const lift = Math.max(18, Math.abs(y2 - y1) / 2)
      const down = y2 > y1 ? lift : -lift
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
      path.setAttribute("d", `M ${x1} ${y1} C ${x1} ${y1 + down}, ${x2} ${y2 - down}, ${x2} ${y2}`)
      path.setAttribute("class", "mb-edge")
      path.dataset.kind = edge.kind
      path.dataset.from = edge.from
      path.dataset.to = edge.to
      edges.append(path)
    }

    for (const edge of marbleEdges(doc)) route(edge)
    for (const lane of doc.lanes) {
      if (lane.born?.from) route({ from: lane.born.from, to: lane.id, kind: "born", label: lane.label })
    }
  }

  const layout = (): void => {
    const doc = player.doc.$()
    geometry = marbleAxis(doc)
    // One track list, read by the axis and by every strip. A marble is on its column because the
    // column is a track, not because two pieces of arithmetic agreed.
    const tracks = marbleTracks(geometry, { pad: AXIS_PAD })
      .map(width => `${width}px`)
      .join(" ")
    scroll.style.setProperty("--mb-tracks", tracks)

    // Axis: one label per column, because the column IS the unit. The numbers are bare and the unit
    // is stated once in the legend: `305ms` is 31px against a 26px compressed column, so repeating
    // the unit on every label is what made two neighbours overlap. The column readout above always
    // says the exact milliseconds of the turn the reveal is standing on.
    axis.replaceChildren()
    axisTicks = new Map()
    const dense = geometry.columns.length > 1 && (geometry.columns[1]?.pitch ?? AXIS_PITCH) < 30
    for (const column of geometry.columns) {
      if (column.compressedMs !== null) {
        const mark = el("span", "mb-break")
        mark.append(el("span", "mb-break-label", `+${column.compressedMs}ms`))
        mark.style.gridColumn = columnLine(column.tick)
        axis.append(mark)
      }
    }
    for (const column of geometry.columns) {
      if (column.events === 0 && column.tick !== 0 && column.compressedMs === null) continue
      const tick = el("span", "mb-tick")
      tick.style.gridColumn = columnLine(column.tick)
      tick.append(el("span", "mb-tick-number", dense ? "" : `t${column.tick}`))
      tick.append(el("span", "mb-tick-ms", `${column.frame}`))
      axis.append(tick)
      axisTicks.set(column.tick, tick)
    }

    measure()
    drawEdges(doc)
    applyReveal(player.revealed.$())
  }

  /** Where a marble's edges attach: the centre of the glyph as drawn, not a corner of its box. A value
   * above a marble and a note below it change the box's size, and a corner anchor would move with the
   * words instead of with the turn. Read from the drawn box because the marble's own transform is what
   * centres it, and the lanes container is the origin the edge overlay is positioned from. */
  const positionOf = (entry: Placed, origin: DOMRect): void => {
    const glyph = entry.node.querySelector<HTMLElement>(".mb-dot, .mb-bar, .mb-caret, .mb-cut") ?? entry.node
    const box = glyph.getBoundingClientRect()
    entry.x = box.left + box.width / 2 - origin.left
    entry.y = box.top + box.height / 2 - origin.top
  }

  const measure = (): void => {
    const origin = lanes.getBoundingClientRect()
    for (const entry of placed) positionOf(entry, origin)
  }

  const build = (): void => {
    const doc: MarbleDoc = player.doc.$()
    title.textContent = doc.title ?? ""
    documentText.textContent = JSON.stringify(doc, null, 2)
    root.setAttribute("aria-label", describeMarbleDoc(doc))
    for (const row of lanes.querySelectorAll(".mb-lane")) row.remove()
    placed = []
    strips = []
    byEvent = new Map()
    laneNodes = new Map()
    laneBirthTick = new Map()
    for (const view of player.laneViews.$()) {
      const row = el("div", "mb-lane")
      row.dataset.lane = view.lane.id
      row.style.height = `${laneHeight(view)}px`
      if (view.lane.born !== null) laneBirthTick.set(view.lane.id, view.lane.born.tick)
      if (view.lane.born?.note !== undefined) row.title = view.lane.born.note
      // The indent rides the label, never the row or the gutter box: every strip has to start at
      // the same x, or the axis drifts away from the lane it describes.
      const gutter = el("div", "mb-gutter")
      gutter.dataset.depth = String(laneDepth(view.lane, doc.lanes))
      const label = el("span", "mb-label", view.lane.label)
      label.style.paddingLeft = `${laneDepth(view.lane, doc.lanes) * 12}px`
      gutter.append(label)
      if (view.lane.born !== null) {
        const born = el(
          "span",
          "mb-born",
          `born t${view.lane.born.tick}${view.lane.born.seed === undefined ? "" : ` seed ${view.lane.born.seed}`}`,
        )
        gutter.append(born)
      }
      const listening = view.listened
      const strip = el("div", "mb-strip")
      strip.setAttribute("role", "img")
      strip.setAttribute("aria-label", describeLane(view.lane, doc))
      const counts = new Map<number, number>()
      for (const notification of view.lane.notifications) {
        counts.set(notification.tick, (counts.get(notification.tick) ?? 0) + 1)
      }
      const placedInColumn = new Map<number, number>()
      for (const notification of view.lane.notifications) {
        const index = placedInColumn.get(notification.tick) ?? 0
        placedInColumn.set(notification.tick, index + 1)
        const count = counts.get(notification.tick) ?? 1
        const node = marbleNode(notification)
        // Hovering any marble answers "what is this" in words, without a trip to the readout.
        node.title = `${view.lane.label}: ${describeNotification(notification, doc)}${
          notification.note === undefined ? "" : ` — ${notification.note}`
        }`
        // What a subscription missed, or no longer hears, is on the diagram but dimmed.
        node.dataset.listened = String(
          listening.length === 0 ||
            listening.some(window => notification.tick >= window.from && notification.tick <= window.to),
        )
        // The column is a grid line, so the marble cannot be anywhere else; the transform centres
        // its own box on that line, and one column's stack offset is the only number left.
        node.style.gridColumn = columnLine(notification.tick)
        node.style.top = `${(index - (count - 1) / 2) * STACK_STEP}px`
        node.style.zIndex = String(10 - index)
        strip.append(node)
        const entry: Placed = { node, lane: view.lane.id, notification, x: 0, y: 0 }
        placed.push(entry)
        byEvent.set(notification.id, entry)
        if (notification.kind === "subscribe" && !laneNodes.has(view.lane.id)) laneNodes.set(view.lane.id, entry)
      }
      row.append(gutter, strip)
      lanes.append(row)
      strips.push({ lane: view.lane.id, strip, row, view })
    }
    measure()
    layout()
  }

  const hoverAt = (lane: string, x: number): MarbleNotification | undefined => {
    let best: Placed | undefined
    for (const entry of placed) {
      if (entry.lane !== lane) continue
      const distance = Math.abs(entry.x - (x + GUTTER))
      if (distance > HOVER_PX) continue
      if (best === undefined || distance < Math.abs(best.x - (x + GUTTER))) best = entry
    }
    return best?.notification
  }

  controls.addEventListener("click", event => {
    const act = event.target instanceof Element ? event.target.closest("[data-act]")?.getAttribute("data-act") : null
    if (act === "toggle") {
      if (player.playing.$()) player.pause()
      else player.play()
    } else if (act === "step-back") player.step(-1)
    else if (act === "step-forward") player.step(1)
    else if (act === "all") player.revealAll()
  })

  const stripOf = (target: Element): StripEntry | undefined => {
    const strip = target.closest(".mb-strip")
    if (strip === null) return undefined
    return strips.find(it => it.strip === strip)
  }

  // Selecting a lane is the only pointer gesture left: there is no seeking, because a reveal is not
  // a place you drag to.
  lanes.addEventListener("pointerdown", event => {
    const target = event.target instanceof Element ? event.target : null
    if (target === null) return
    const row = target.closest(".mb-lane")
    const id = row?.getAttribute("data-lane")
    if (id != null) player.selected.$(player.selected.$() === id ? null : id)
  })

  lanes.addEventListener("pointermove", event => {
    const target = event.target instanceof Element ? event.target : null
    const hit = target === null ? undefined : stripOf(target)
    if (hit === undefined) {
      if (player.hovered.$() !== null) player.hovered.$(null)
      return
    }
    const x = event.clientX - hit.strip.getBoundingClientRect().left
    const notification = hoverAt(hit.lane, x)
    if (notification !== undefined) player.hovered.$({ lane: hit.lane, notification })
    else if (player.hovered.$() !== null) player.hovered.$(null)
  })

  lanes.addEventListener("pointerleave", () => player.hovered.$(null))

  const observer = new ResizeObserver(() => measure())
  observer.observe(root)

  build()
  live.push(player.doc.$.pipe(skip(1)).subscribe(build))
  live.push(player.revealed.$.subscribe(applyReveal))
  live.push(
    combineLatest([player.playing.$, player.revealed.$]).subscribe(([playing]) => {
      toggle.textContent = playing ? "pause" : "play"
    }),
  )
  live.push(
    player.speed.$.subscribe(value => {
      root.style.setProperty("--mb-speed", String(value))
    }),
  )
  live.push(
    player.selected.$.subscribe(selected => {
      for (const entry of strips) entry.row.dataset.selected = String(entry.lane === selected)
    }),
  )
  live.push(
    player.hovered.$.subscribe(hovered => {
      for (const entry of placed) {
        const on = hovered !== null && hovered.lane === entry.lane && hovered.notification.id === entry.notification.id
        if (on !== (entry.node.dataset.hovered === "true")) entry.node.dataset.hovered = String(on)
      }
    }),
  )

  return {
    unsubscribe: () => {
      for (const subscription of live) subscription.unsubscribe()
      observer.disconnect()
      host.replaceChildren()
    },
  }
}
