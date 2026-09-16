// The surface. Framework-free on purpose: `renderMarbles` decorates an element and returns its
// teardown, which is exactly an effect's contract, so the React adapter is the effect and nothing
// else.
//
// The subscriptions this package makes live here, because a renderer IS a boundary — it owns
// native nodes and has to release them. `stop()` is that release, so a caller that never calls it
// has a leak it can name, which is the whole point of the rule.
import { type Subscription, skip } from "rxjs"
import { describeLane, describeMarbleDoc, type MarbleDoc, type MarbleNotification } from "./0_types.js"
import { printMarbles } from "./1_notation.js"
import type { MarbleLaneView, MarblePlayer } from "./4_player.js"

const GUTTER = 168
/** Room at both ends of a strip, so a marble on the first or last frame is not half off it. */
const PAD = 16
const BASE_ROW = 38
const STACK_STEP = 13
const HOVER_PX = 14
const SPEEDS = [0.5, 1, 2, 4]
const AXIS_TICKS = 7

export type MarbleRender = { stop: () => void }

type NodeEntry = { node: HTMLElement; notification: MarbleNotification; x: number; lane: string }
type StripEntry = { lane: string; strip: HTMLElement; row: HTMLElement; view: MarbleLaneView }

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

/** Rounded tick spacing that puts a readable number of labels on the axis. */
export function tickFrames(total: number, count: number = AXIS_TICKS): number[] {
  const raw = total / count
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(raw, 1)))
  const step = [1, 2, 5, 10].map(multiple => multiple * magnitude).find(candidate => candidate >= raw) ?? magnitude * 10
  const ticks: number[] = []
  for (let frame = 0; frame <= total; frame += step) ticks.push(frame)
  return ticks
}

/** How many marbles share a frame anywhere in this lane, which is how tall the lane has to be. */
function laneHeight(view: MarbleLaneView): number {
  const perFrame = new Map<number, number>()
  for (const notification of view.lane.notifications)
    perFrame.set(notification.frame, (perFrame.get(notification.frame) ?? 0) + 1)
  let deepest = 1
  for (const count of perFrame.values()) deepest = Math.max(deepest, count)
  return BASE_ROW + (deepest - 1) * STACK_STEP
}

function marbleNode(notification: MarbleNotification): HTMLElement {
  const node = el("span", "mb-marble")
  node.dataset.kind = notification.kind
  node.dataset.frame = String(notification.frame)
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
    case "unsubscribe":
      node.append(el("span", "mb-caret"))
      break
  }
  return node
}

export function renderMarbles(player: MarblePlayer, host: HTMLElement): MarbleRender {
  const root = el("div", "mb-root")
  root.setAttribute("role", "group")
  // One number decides the gutter: the renderer measures strips against it, the playhead and the
  // axis are placed with it, and a host that overrides the variable moves all three together.
  root.style.setProperty("--mb-gutter", `${GUTTER}px`)
  const head = el("div", "mb-head")
  const title = el("div", "mb-title")
  const controls = el("div", "mb-controls")
  const stepBack = el("button", "mb-control", "\u2039")
  const toggle = el("button", "mb-control", "play")
  const stepForward = el("button", "mb-control", "\u203a")
  const speed = el("button", "mb-control", "1\u00d7")
  const loop = el("button", "mb-control", "loop")
  const readout = el("span", "mb-readout", "0 / 0")
  stepBack.dataset.act = "step-back"
  toggle.dataset.act = "toggle"
  stepForward.dataset.act = "step-forward"
  speed.dataset.act = "speed"
  loop.dataset.act = "loop"
  controls.append(stepBack, toggle, stepForward, speed, loop, readout)
  head.append(title, controls)

  const lanes = el("div", "mb-lanes")
  const playhead = el("div", "mb-playhead")
  lanes.append(playhead)
  const axis = el("div", "mb-axis")
  const notation = el("details", "mb-notation")
  notation.append(el("summary", "mb-notation-summary", "notation"))
  const pre = el("pre", "mb-notation-text")
  notation.append(pre)
  root.append(head, lanes, axis, notation)
  host.replaceChildren(root)

  const live: Subscription[] = []
  let entries: NodeEntry[] = []
  let strips: StripEntry[] = []
  // Filled by `layout`, the only place that knows how wide a strip ended up.
  const geometry = { inner: 1, total: 1 }
  const xAt = (frame: number): number =>
    PAD + (Math.min(Math.max(frame, 0), geometry.total) / geometry.total) * geometry.inner
  const frameAt = (x: number): number => ((x - PAD) / geometry.inner) * geometry.total

  const applyFrame = (frame: number): void => {
    playhead.style.left = `calc(var(--mb-gutter) + ${xAt(frame)}px)`
    readout.textContent = `${Math.round(frame)} / ${geometry.total}`
    for (const entry of entries) {
      const played = String(frame >= entry.notification.frame)
      if (entry.node.dataset.played !== played) entry.node.dataset.played = played
    }
  }

  const layout = (): void => {
    const width = strips[0]?.strip.clientWidth ?? 0
    if (width <= 0) return
    geometry.inner = Math.max(width - 2 * PAD, 1)
    geometry.total = Math.max(player.duration.$(), 1)
    for (const entry of entries) {
      entry.x = xAt(entry.notification.frame)
      entry.node.style.left = `${entry.x}px`
    }
    axis.replaceChildren()
    for (const frame of tickFrames(geometry.total)) {
      const tick = el("span", "mb-tick", String(frame))
      tick.style.left = `calc(var(--mb-gutter) + ${xAt(frame)}px)`
      axis.append(tick)
    }
    applyFrame(player.frame.$())
  }

  const build = (): void => {
    const doc: MarbleDoc = player.doc.$()
    title.textContent = doc.title ?? ""
    pre.textContent = printMarbles(doc)
    root.setAttribute("aria-label", describeMarbleDoc(doc))
    for (const row of lanes.querySelectorAll(".mb-lane")) row.remove()
    entries = []
    strips = []
    for (const view of player.laneViews.$()) {
      const row = el("div", "mb-lane")
      row.dataset.lane = view.lane.id
      row.style.height = `${laneHeight(view)}px`
      // The indent rides the label, never the row or the gutter box: every strip has to start at
      // the same x, or the axis and the playhead drift away from the lane they describe.
      const gutter = el("div", "mb-gutter")
      gutter.dataset.depth = String(view.depth)
      const label = el("span", "mb-label", view.lane.label)
      label.style.paddingLeft = `${view.depth * 12}px`
      gutter.append(label)
      const listening = view.listened
      const strip = el("div", "mb-strip")
      strip.setAttribute("role", "img")
      strip.setAttribute("aria-label", describeLane(view.lane))
      const counts = new Map<number, number>()
      for (const notification of view.lane.notifications)
        counts.set(notification.frame, (counts.get(notification.frame) ?? 0) + 1)
      const placed = new Map<number, number>()
      for (const notification of view.lane.notifications) {
        const index = placed.get(notification.frame) ?? 0
        placed.set(notification.frame, index + 1)
        const count = counts.get(notification.frame) ?? 1
        const node = marbleNode(notification)
        // What a subscription missed, or no longer hears, is on the diagram but dimmed.
        node.dataset.listened = String(
          listening.length === 0 ||
            listening.some(window => notification.frame >= window.from && notification.frame <= window.to),
        )
        // A frame carrying several marbles stacks them around the baseline instead of over it.
        node.style.top = count === 1 ? "50%" : `calc(50% + ${(index - (count - 1) / 2) * STACK_STEP}px)`
        node.style.zIndex = String(10 - index)
        strip.append(node)
        entries.push({ node, notification, x: 0, lane: view.lane.id })
      }
      row.append(gutter, strip)
      lanes.append(row)
      strips.push({ lane: view.lane.id, strip, row, view })
    }
    layout()
  }

  const hoverAt = (lane: string, x: number): MarbleNotification | undefined => {
    let best: NodeEntry | undefined
    for (const entry of entries) {
      if (entry.lane !== lane) continue
      const distance = Math.abs(entry.x - x)
      if (distance > HOVER_PX) continue
      if (best === undefined || distance < Math.abs(best.x - x)) best = entry
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
    else if (act === "speed") {
      const next = SPEEDS[(SPEEDS.indexOf(player.speed.$()) + 1) % SPEEDS.length] ?? 1
      player.speed.$(next)
    } else if (act === "loop") player.loop.$(!player.loop.$())
  })

  const stripOf = (target: Element): StripEntry | undefined => {
    const strip = target.closest(".mb-strip")
    if (strip === null) return undefined
    return strips.find(it => it.strip === strip)
  }

  lanes.addEventListener("pointerdown", event => {
    const target = event.target instanceof Element ? event.target : null
    if (target === null) return
    const gutter = target.closest(".mb-gutter")
    if (gutter !== null) {
      const id = gutter.closest(".mb-lane")?.getAttribute("data-lane")
      if (id != null) player.selected.$(player.selected.$() === id ? null : id)
      return
    }
    const hit = stripOf(target)
    if (hit === undefined) return
    player.pause()
    hit.strip.setPointerCapture(event.pointerId)
    player.seek(frameAt(event.clientX - hit.strip.getBoundingClientRect().left))
  })

  lanes.addEventListener("pointermove", event => {
    const target = event.target instanceof Element ? event.target : null
    const hit = target === null ? undefined : stripOf(target)
    if (hit === undefined) {
      if (player.hovered.$() !== null) player.hovered.$(null)
      return
    }
    const x = event.clientX - hit.strip.getBoundingClientRect().left
    if (event.buttons === 1) player.seek(frameAt(x))
    const notification = hoverAt(hit.lane, x)
    if (notification !== undefined) player.hovered.$({ lane: hit.lane, notification })
    else if (player.hovered.$() !== null) player.hovered.$(null)
  })

  lanes.addEventListener("pointerleave", () => player.hovered.$(null))

  const observer = new ResizeObserver(layout)
  observer.observe(root)

  build()
  live.push(player.doc.$.pipe(skip(1)).subscribe(build))
  live.push(player.frame.$.subscribe(applyFrame))
  live.push(
    player.playing.$.subscribe(playing => {
      toggle.textContent = playing ? "pause" : "play"
    }),
  )
  live.push(
    player.loop.$.subscribe(on => {
      loop.dataset.on = String(on)
    }),
  )
  live.push(
    player.speed.$.subscribe(value => {
      speed.textContent = `${value}\u00d7`
    }),
  )
  live.push(
    player.selected.$.subscribe(selected => {
      for (const entry of strips) entry.row.dataset.selected = String(entry.lane === selected)
    }),
  )
  live.push(
    player.hovered.$.subscribe(hovered => {
      for (const entry of entries) {
        const on =
          hovered !== null && hovered.lane === entry.lane && hovered.notification.frame === entry.notification.frame
        if (on !== (entry.node.dataset.hovered === "true")) entry.node.dataset.hovered = String(on)
      }
    }),
  )

  return {
    stop: () => {
      for (const subscription of live) subscription.unsubscribe()
      observer.disconnect()
      host.replaceChildren()
    },
  }
}
