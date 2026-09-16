import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { interval } from "rxjs"
import { describe, expect, it } from "vitest"
import { page } from "vitest/browser"
import { marbleDoc } from "./0_document.js"
import { AXIS_MAX_PITCH, AXIS_PITCH, type MarbleDoc } from "./0_types.js"
import { runMarbleDemo } from "./2_run.js"
import { createMarblePlayer, type MarblePlayer } from "./4_player.js"
import { renderMarbles } from "./5_render.js"
import { MarbleDiagram } from "./react.js"
import "./marbles.css"

// `act` refuses to batch without it, and every call warns on the console instead.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/** Everything the four terminal glyphs must be told apart by, plus a note on the last two. */
const AUTHORED: MarbleDoc = marbleDoc({
  title: "a window that closed, a failure, and a cancellation",
  lanes: [
    {
      id: "source",
      label: "source",
      events: [
        { tick: 1, value: "a" },
        { after: 1, value: "b", note: "only because the gap was long enough" },
        { after: 1, ms: 300, value: "c", note: "300ms of nothing in between" },
        { after: 1, kind: "complete" },
      ],
    },
    {
      id: "failed",
      label: "failed",
      parent: "source",
      events: [{ tick: 2, kind: "error", value: "boom" }],
    },
    {
      id: "cut",
      label: "cut",
      parent: "source",
      events: [
        { tick: 1, kind: "subscribe" },
        { tick: 3, value: "b" },
        { after: 1, kind: "truncate", note: "the window closed here" },
      ],
    },
    {
      id: "dropped",
      label: "dropped",
      parent: "source",
      events: [
        { tick: 1, kind: "subscribe" },
        { tick: 3, kind: "unsubscribe", note: "nobody was listening any more" },
      ],
    },
  ],
})

/** Real RxJS: the cancellation, the routing edges, and the notes the runner writes for itself. */
const RUN: MarbleDoc = runMarbleDemo(
  lanes => {
    const outer = lanes.through("outer", interval(10).pipe(), { label: "interval(10)" })
    lanes.each("switched", outer, () => interval(6), {
      op: "switch",
      name: "request",
      label: "switchMap",
      parent: "outer",
    })
  },
  { windowMs: 34, title: "switchMap drops the inner request" },
).doc

type Mount = { host: HTMLElement; player: MarblePlayer; unsubscribe: () => void }

function mount(testId: string, doc: MarbleDoc): Mount {
  const host = document.createElement("div")
  host.dataset.testid = testId
  host.style.inlineSize = "900px"
  document.body.append(host)
  const player = createMarblePlayer(doc)
  const view = renderMarbles(player, host)
  return {
    host,
    player,
    unsubscribe: () => {
      view.unsubscribe()
      host.remove()
    },
  }
}

const marbles = (host: HTMLElement, lane: string): HTMLElement[] => [
  ...host.querySelectorAll<HTMLElement>(`.mb-lane[data-lane="${lane}"] .mb-marble`),
]

const states = (host: HTMLElement, lane: string): Array<string | undefined> =>
  marbles(host, lane).map(node => node.dataset.state)

describe("renderMarbles", () => {
  it("draws a lane per lane, indented by parent, with a name for every event and the document in the details", () => {
    const { host, unsubscribe } = mount("structure", AUTHORED)
    expect([...host.querySelectorAll<HTMLElement>(".mb-lane")].map(row => row.dataset.lane)).toEqual([
      "source",
      "failed",
      "cut",
      "dropped",
    ])
    expect(host.querySelector('.mb-lane[data-lane="failed"] .mb-gutter')?.getAttribute("data-depth")).toBe("1")
    // A marble is a thing with a name, not a shape at an x: the name is on the node.
    expect(marbles(host, "source").map(node => node.dataset.marble)).toEqual([
      "source#1",
      "source#2",
      "source#3",
      "source#4",
    ])
    expect(host.querySelector(".mb-document-text")?.textContent).toContain('"tick": 3')
    unsubscribe()
  })

  it("hides what the reveal has not reached, and says which column it stands on", () => {
    const { host, player, unsubscribe } = mount("reveal", AUTHORED)
    // A diagram in a page is a picture, so nothing is hidden to begin with.
    expect(states(host, "source")).toEqual(["shown", "shown", "shown", "current"])
    // The source's events are on columns 1..4; column 1 is the first of them.
    player.revealAt(1)
    expect(states(host, "source")).toEqual(["current", "hidden", "hidden", "hidden"])
    expect(host.querySelector(".mb-readout")?.textContent).toContain("column 2 of 5")
    // Hidden is absent, not faint: it is not in the accessibility tree either.
    const hidden = marbles(host, "source")[2]
    expect(hidden === undefined ? "" : getComputedStyle(hidden).display).toBe("none")
    expect(getComputedStyle(marbles(host, "source")[0] as HTMLElement).display).not.toBe("none")
    unsubscribe()
  })

  it("renders four terminals as four glyphs a reader can tell apart", () => {
    const { host, unsubscribe } = mount("terminals", AUTHORED)
    const glyph = (lane: string, index: number): string => {
      const node = marbles(host, lane)[index]
      const child = node?.firstElementChild
      return child === null || child === undefined ? "" : child.className
    }
    expect(glyph("source", 3)).toBe("mb-bar")
    expect(glyph("failed", 0)).toBe("mb-dot")
    expect(glyph("dropped", 1)).toBe("mb-caret")
    expect(glyph("cut", 2)).toBe("mb-cut")
    // The cancelled caret points the other way from the subscription that opened the window.
    const up = marbles(host, "dropped")[0]?.firstElementChild
    const down = marbles(host, "dropped")[1]?.firstElementChild
    expect(getComputedStyle(up as Element).transform).not.toBe(getComputedStyle(down as Element).transform)
    unsubscribe()
  })

  it("shows a note with the marble it belongs to, and only once that marble has happened", () => {
    const { host, player, unsubscribe } = mount("notes", AUTHORED)
    const noted = marbles(host, "source")[1]
    expect(noted?.querySelector(".mb-note")?.textContent).toContain("only because the gap")
    expect(noted?.querySelector(".mb-note")?.getAttribute("title")).toBe("only because the gap was long enough")
    player.revealAt(0)
    expect(states(host, "source")[1]).toBe("hidden")
    // The column the note's marble sits on: it is the current one, and what came before is behind it.
    player.revealAt(2)
    expect(states(host, "source")).toEqual(["shown", "current", "hidden", "hidden"])
    expect(marbles(host, "source")[1]?.dataset.state).toBe("current")
    unsubscribe()
  })

  it("prints the milliseconds every column sits at, and breaks the axis where it refused to draw", () => {
    const { host, unsubscribe } = mount("axis", AUTHORED)
    const ms = [...host.querySelectorAll<HTMLElement>(".mb-tick-ms")].map(node => node.textContent)
    expect(ms.slice(0, 5)).toEqual(["0ms", "1ms", "2ms", "302ms", "303ms"])
    const breaks = [...host.querySelectorAll<HTMLElement>(".mb-break")].map(node => node.textContent)
    expect(breaks).toEqual(["+300ms"])
    unsubscribe()
  })

  it("reads the current column out in words, naming each event and where it came from", () => {
    const { host, player, unsubscribe } = mount("panel", AUTHORED)
    player.revealAt(3)
    const head = host.querySelector(".mb-panel-head")?.textContent ?? ""
    expect(head.toLowerCase()).toContain("column 4")
    expect(head).toContain("302ms")
    const rows = [...host.querySelectorAll(".mb-panel-row")].map(row => row.textContent ?? "")
    expect(rows.some(row => row.includes("source#3") && row.includes("value"))).toBe(true)
    expect(rows.some(row => row.includes("300ms of nothing"))).toBe(true)
    unsubscribe()
  })

  it("draws an edge from the event that caused a subscription to the subscription", () => {
    const { host, player, unsubscribe } = mount("edges", RUN)
    const drawn = [...host.querySelectorAll<SVGPathElement>(".mb-edge")]
    expect(drawn.length).toBeGreaterThan(0)
    const birth = drawn.find(path => path.dataset.kind === "born")
    expect(birth?.dataset.from).toBe("outer#1")
    expect(birth?.dataset.to).toBe("request1")
    // The column a lane started on says so, with the event that caused it and the value it was handling.
    player.revealAt(1)
    const startRows = [...host.querySelectorAll(".mb-panel-row")].map(row => row.textContent ?? "")
    expect(startRows.some(row => row.includes("request #1") && row.includes("from outer#1"))).toBe(true)
    player.revealAll()
    // An edge is drawn only when both of its ends have happened: the birth of the third inner is
    // from a column the reveal has not reached.
    player.revealAt(1)
    expect(birth?.dataset.state).toBe("current")
    const later = drawn.find(path => path.dataset.from === "outer#3")
    expect(later?.dataset.state).toBe("hidden")
    expect(getComputedStyle(later as Element).display).toBe("none")
    expect(getComputedStyle(birth as Element).display).not.toBe("none")
    unsubscribe()
  })

  it("writes the reason an inner was cancelled, in the runner's own words", () => {
    const { host, unsubscribe } = mount("fates", RUN)
    const notes = [...host.querySelectorAll<HTMLElement>(".mb-note")].map(node => node.textContent ?? "")
    expect(notes.some(note => note.includes("switch dropped it"))).toBe(true)
    expect(notes.some(note => note.includes("window closed"))).toBe(true)
    unsubscribe()
  })

  it("steps and shows the whole picture from the controls", () => {
    const { host, player, unsubscribe } = mount("controls", AUTHORED)
    // From the picture, back is the column before the last; forward is the end, so it holds.
    host.querySelector<HTMLButtonElement>('[data-act="step-back"]')?.click()
    expect(player.revealed.$()).toBe(3)
    host.querySelector<HTMLButtonElement>('[data-act="step-back"]')?.click()
    expect(player.revealed.$()).toBe(2)
    host.querySelector<HTMLButtonElement>('[data-act="step-forward"]')?.click()
    expect(player.revealed.$()).toBe(3)
    host.querySelector<HTMLButtonElement>('[data-act="all"]')?.click()
    expect(player.revealed.$()).toBe("all")
    expect(host.querySelector(".mb-readout")?.textContent).toContain("5 columns")
    unsubscribe()
  })

  it("names each lane for a screen reader and releases its nodes on unsubscribe", () => {
    const { host, unsubscribe } = mount("aria", AUTHORED)
    expect(host.querySelector('.mb-lane[data-lane="failed"] .mb-strip')?.getAttribute("aria-label")).toContain(
      "error boom at tick 2",
    )
    expect(host.querySelector(".mb-root")?.getAttribute("aria-label")).toContain("4 lanes over 5 columns")
    unsubscribe()
    expect(host.childElementCount).toBe(0)
  })

  it("selects a lane through a real pointer, and nothing seeks", async () => {
    const { host, player, unsubscribe } = mount("select", AUTHORED)
    const gutter = host.querySelector<HTMLElement>('.mb-lane[data-lane="failed"] .mb-gutter')
    expect(gutter).not.toBeNull()
    if (gutter === null) return
    const hostBox = host.getBoundingClientRect()
    const box = gutter.getBoundingClientRect()
    await page.getByTestId("select").click({
      position: { x: box.left - hostBox.left + 8, y: box.top - hostBox.top + box.height / 2 },
    })
    expect(player.selected.$()).toBe("failed")
    expect(host.querySelector('.mb-lane[data-lane="failed"]')?.getAttribute("data-selected")).toBe("true")
    // The reveal is not something a pointer writes: the diagram stays the picture it was.
    expect(player.revealed.$()).toBe("all")
    unsubscribe()
  })
})

describe("MarbleDiagram", () => {
  it("mounts a player, follows a new document, and unmounts clean", async () => {
    const host = document.createElement("div")
    host.dataset.testid = "signal-marbles"
    host.style.inlineSize = "900px"
    document.body.append(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(createElement(MarbleDiagram, { player: createMarblePlayer(AUTHORED) }))
    })
    expect(host.querySelectorAll(".mb-lane")).toHaveLength(4)
    const player = createMarblePlayer(AUTHORED)
    player.revealAt(3)
    await act(async () => {
      root.render(createElement(MarbleDiagram, { player }))
    })
    expect([...host.querySelectorAll(".mb-lane")].map(row => row.getAttribute("data-lane"))).toEqual([
      "source",
      "failed",
      "cut",
      "dropped",
    ])
    await expect(host).toMatchScreenshot("marble-diagram")
    await act(async () => {
      root.unmount()
    })
    expect(host.childElementCount).toBe(0)
    host.remove()
  })

  it("keeps the same player across a parent re-render with the same identity", async () => {
    const host = document.createElement("div")
    document.body.append(host)
    const root = createRoot(host)
    const player = createMarblePlayer(AUTHORED)
    await act(async () => {
      root.render(createElement(MarbleDiagram, { player }))
    })
    const before = host.querySelector(".mb-lane")
    await act(async () => {
      root.render(createElement(MarbleDiagram, { player, className: "again" }))
    })
    expect(host.querySelector(".mb-lane")).toBe(before)
    await act(async () => {
      root.unmount()
    })
    host.remove()
  })
})

/**
 * Geometry. Every assertion here measures the laid-out DOM and compares it against the document, so
 * "the marbles are grouped on their columns" is a number rather than an opinion — and the axis is
 * checked against the same marbles, which is what catches a label that drifted a gutter away.
 */
const centreOf = (node: Element): { x: number; y: number } => {
  const box = node.getBoundingClientRect()
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
}

const tickLabels = (host: HTMLElement): Array<{ tick: number; x: number }> =>
  [...host.querySelectorAll<HTMLElement>(".mb-tick")]
    .map(node => ({
      tick: Number(node.querySelector(".mb-tick-number")?.textContent?.replace("t", "") ?? "-1"),
      x: centreOf(node).x,
    }))
    .sort((left, right) => left.x - right.x)

const marblesByTick = (host: HTMLElement): Map<number, HTMLElement[]> => {
  const byTick = new Map<number, HTMLElement[]>()
  for (const node of host.querySelectorAll<HTMLElement>(".mb-marble")) {
    const tick = Number(node.dataset.tick)
    byTick.set(tick, [...(byTick.get(tick) ?? []), node])
  }
  return byTick
}

describe("geometry", () => {
  it("puts every marble on the column its label stands on, and every column's marbles at one x", () => {
    const { host, unsubscribe } = mount("geometry-align", RUN)
    const labels = new Map(tickLabels(host).map(label => [label.tick, label.x]))
    const byTick = marblesByTick(host)
    expect(byTick.size).toBeGreaterThan(3)
    for (const [tick, nodes] of byTick) {
      const column = labels.get(tick)
      // A marble on a column the axis did not label would be a marble with nothing to read it against.
      expect(column, `no tick label for column ${tick}`).toBeDefined()
      const xs = nodes.map(node => centreOf(node).x)
      for (const x of xs) expect(Math.abs(x - (column ?? 0))).toBeLessThanOrEqual(1)
      // One column, one x: what shares a turn is stacked, not strung out.
      expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(1)
    }
    unsubscribe()
  })

  it("counts the marbles per column against the document, not against itself", () => {
    const { host, player, unsubscribe } = mount("geometry-count", RUN)
    const doc = player.doc.$()
    const expected = new Map<number, number>()
    for (const lane of doc.lanes) {
      for (const notification of lane.notifications) {
        expected.set(notification.tick, (expected.get(notification.tick) ?? 0) + 1)
      }
    }
    const drawn = marblesByTick(host)
    expect([...drawn.keys()].sort((a, b) => a - b)).toEqual([...expected.keys()].sort((a, b) => a - b))
    for (const [tick, count] of expected) expect(drawn.get(tick)?.length).toBe(count)
    unsubscribe()
  })

  it("stacks what shares a turn and keeps every lane's marbles inside its own row", () => {
    const { host, player, unsubscribe } = mount("geometry-stack", RUN)
    const doc = player.doc.$()
    for (const lane of doc.lanes) {
      const row = host.querySelector<HTMLElement>(`.mb-lane[data-lane="${lane.id}"]`)
      expect(row).not.toBeNull()
      if (row === null) continue
      const rowBox = row.getBoundingClientRect()
      const nodes = marbles(host, lane.id)
      expect(nodes.length).toBe(lane.notifications.length)
      for (const node of nodes) {
        const box = node.getBoundingClientRect()
        expect(box.left).toBeGreaterThanOrEqual(rowBox.left)
        expect(box.right).toBeLessThanOrEqual(rowBox.right + 1)
      }
      // Two marbles on one column are two rows of pixels, never one on top of the other.
      const byTick = new Map<number, number[]>()
      for (const node of nodes) {
        const tick = Number(node.dataset.tick)
        byTick.set(tick, [...(byTick.get(tick) ?? []), centreOf(node).y])
      }
      for (const ys of byTick.values()) {
        if (ys.length < 2) continue
        expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(4)
      }
    }
    unsubscribe()
  })

  it("gives equal time gaps equal pitch, and never less than one column or more than the cap", () => {
    const { host, unsubscribe } = mount("geometry-pitch", RUN)
    const labels = tickLabels(host)
    const gaps: number[] = []
    for (let index = 1; index < labels.length; index += 1) {
      gaps.push((labels[index]?.x ?? 0) - (labels[index - 1]?.x ?? 0))
    }
    expect(gaps.length).toBeGreaterThan(3)
    for (const gap of gaps) {
      expect(gap).toBeGreaterThanOrEqual(AXIS_PITCH - 1)
      expect(gap).toBeLessThanOrEqual(AXIS_MAX_PITCH + 1)
    }
    // Consecutive columns in this document differ by 0ms, 6ms or 12ms, so three pitches at most.
    expect(new Set(gaps.map(gap => Math.round(gap))).size).toBeLessThanOrEqual(3)
    unsubscribe()
  })

  it("stands the break on the column it belongs to, carrying the time it refused to draw", () => {
    const { host, unsubscribe } = mount("geometry-break", AUTHORED)
    const labels = tickLabels(host)
    const breaks = [...host.querySelectorAll<HTMLElement>(".mb-break")]
    expect(breaks).toHaveLength(1)
    const mark = breaks[0]
    expect(mark?.textContent).toBe("+300ms")
    if (mark === undefined) return
    const x = mark.getBoundingClientRect().left
    // The column that cost the 300ms: the first label at or past the break.
    const landed = labels.find(label => label.x >= x - 1)
    expect(landed).toBeDefined()
    expect(Math.abs((landed?.x ?? 0) - x)).toBeLessThanOrEqual(AXIS_PITCH)
    unsubscribe()
  })

  it("keeps the readout on one turn: its rows are that column's events, and nothing else", () => {
    const { host, player, unsubscribe } = mount("geometry-panel", RUN)
    const doc = player.doc.$()
    for (const tick of [1, 3, 5]) {
      player.revealAt(tick)
      const ids = new Set(
        doc.lanes.flatMap(lane =>
          lane.notifications.filter(notification => notification.tick === tick).map(notification => notification.id),
        ),
      )
      const rows = [...host.querySelectorAll(".mb-panel-row")]
      expect(rows.length).toBeGreaterThan(0)
      for (const row of rows) {
        const name = row.querySelector(".mb-panel-name")?.textContent ?? ""
        // A birth row names its lane; an event row names its event id.
        expect([...ids].some(id => name === id) || doc.lanes.some(lane => lane.id === name)).toBe(true)
      }
      const marked = [...host.querySelectorAll<HTMLElement>('.mb-marble[data-state="current"]')]
      for (const node of marked) expect(Number(node.dataset.tick)).toBe(tick)
    }
    unsubscribe()
  })
})
