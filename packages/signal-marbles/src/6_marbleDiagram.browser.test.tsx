import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { describe, expect, it } from "vitest"
import { page } from "vitest/browser"
import { readMarbles } from "./1_notation.js"
import { createMarblePlayer, type MarblePlayer } from "./4_player.js"
import { renderMarbles, tickFrames } from "./5_render.js"
import { MarbleDiagram } from "./react.js"
import "./marbles.css"

// `act` refuses to batch without it, and every call warns on the console instead.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const SOURCE = [
  "@title a window and a derivation",
  "@legend k=key r=request",
  "",
  "keys      : -k-k-k-|",
  "  mapped  : -r-r-r-|",
  "hot       : -k-^--k--!",
].join("\n")

type Mount = { host: HTMLElement; player: MarblePlayer; stop: () => void }

function mount(testId: string): Mount {
  const host = document.createElement("div")
  host.dataset.testid = testId
  host.style.inlineSize = "900px"
  document.body.append(host)
  const player = createMarblePlayer(readMarbles(SOURCE))
  const view = renderMarbles(player, host)
  return {
    host,
    player,
    stop: () => {
      view.stop()
      host.remove()
    },
  }
}

const marbles = (host: HTMLElement, lane: string): HTMLElement[] => [
  ...host.querySelectorAll<HTMLElement>(`.mb-lane[data-lane="${lane}"] .mb-marble`),
]

const marks = (host: HTMLElement, lane: string): Array<[string | undefined, string | undefined]> =>
  marbles(host, lane).map(node => [node.dataset.kind, node.dataset.frame])

describe("renderMarbles", () => {
  it("draws a lane per lane, indented by derivation, with the notation it read", () => {
    const { host, stop } = mount("structure")
    const rows = [...host.querySelectorAll<HTMLElement>(".mb-lane")]
    expect(rows.map(row => row.dataset.lane)).toEqual(["keys", "mapped", "hot"])
    expect(host.querySelector('.mb-lane[data-lane="mapped"] .mb-gutter')?.getAttribute("data-depth")).toBe("1")
    expect(host.querySelector(".mb-notation-text")?.textContent).toContain("keys")
    expect(host.querySelector(".mb-title")?.textContent).toBe("a window and a derivation")
    stop()
  })

  it("draws every notification as a marble at the frame it happened on", () => {
    const { host, stop } = mount("marks")
    expect(marks(host, "keys")).toEqual([
      ["next", "1"],
      ["next", "3"],
      ["next", "5"],
      ["complete", "7"],
    ])
    expect(marks(host, "hot")).toEqual([
      ["next", "1"],
      ["subscribe", "3"],
      ["next", "6"],
      ["unsubscribe", "9"],
    ])
    stop()
  })

  it("marks what the playhead has reached, and what the lane was listening for", () => {
    const { host, player, stop } = mount("played")
    player.seek(3)
    expect(marbles(host, "keys").map(node => node.dataset.played)).toEqual(["true", "true", "false", "false"])
    // The key at frame 1 arrived before the subscription at frame 3 was made.
    expect(marbles(host, "hot").map(node => node.dataset.listened)).toEqual(["false", "true", "true", "true"])
    stop()
  })

  it("reads the strip as geometry: a press at either end is the start or the end of the diagram", async () => {
    const { host, player, stop } = mount("seek")
    const strip = host.querySelector<HTMLElement>('.mb-lane[data-lane="keys"] .mb-strip')
    expect(strip).not.toBeNull()
    if (strip === null) return
    const hostBox = host.getBoundingClientRect()
    const box = strip.getBoundingClientRect()
    const y = box.top - hostBox.top + box.height / 2
    const duration = player.duration.$()
    await page.getByTestId("seek").click({ position: { x: box.left - hostBox.left + 2, y } })
    expect(player.frame.$()).toBeLessThan(1)
    await page.getByTestId("seek").click({ position: { x: box.right - hostBox.left - 1, y } })
    expect(player.frame.$()).toBeGreaterThan(duration - 1)
    stop()
  })

  it("advances the frame while playing and holds it on pause", async () => {
    const { host, player, stop } = mount("play")
    const toggle = host.querySelector<HTMLButtonElement>('[data-act="toggle"]')
    expect(toggle).not.toBeNull()
    toggle?.click()
    expect(player.playing.$()).toBe(true)
    await expect.poll(() => player.frame.$(), { timeout: 4000 }).toBeGreaterThan(2)
    toggle?.click()
    expect(player.playing.$()).toBe(false)
    // Pausing saves the playhead as the resume point; the clock's own test covers it holding there.
    expect(player.position.$()).toBe(player.frame.$())
    stop()
  })

  it("takes a step to the next frame that has something on it", () => {
    const { host, player, stop } = mount("step")
    host.querySelector<HTMLButtonElement>('[data-act="step-forward"]')?.click()
    expect(player.frame.$()).toBe(1)
    host.querySelector<HTMLButtonElement>('[data-act="step-forward"]')?.click()
    expect(player.frame.$()).toBe(3)
    host.querySelector<HTMLButtonElement>('[data-act="step-back"]')?.click()
    expect(player.frame.$()).toBe(1)
    stop()
  })

  it("selects a lane from its name and shows it on the row", () => {
    const { host, player, stop } = mount("select")
    const gutter = host.querySelector<HTMLElement>('.mb-lane[data-lane="mapped"] .mb-gutter')
    gutter?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }))
    expect(player.selected.$()).toBe("mapped")
    expect(host.querySelector('.mb-lane[data-lane="mapped"]')?.getAttribute("data-selected")).toBe("true")
    stop()
  })

  it("names each lane for a screen reader and releases its nodes on stop", () => {
    const { host, stop } = mount("aria")
    expect(host.querySelector('.mb-lane[data-lane="mapped"] .mb-strip')?.getAttribute("aria-label")).toBe(
      "mapped: request at 1, request at 3, request at 5, complete at 7",
    )
    expect(host.querySelector(".mb-root")?.getAttribute("aria-label")).toContain("3 lanes over 10 frames")
    stop()
    expect(host.childElementCount).toBe(0)
  })

  it("labels the axis with rounded frame numbers", () => {
    expect(tickFrames(10)).toEqual([0, 2, 4, 6, 8, 10])
    expect(tickFrames(30)).toEqual([0, 5, 10, 15, 20, 25, 30])
    expect(tickFrames(1000)).toEqual([0, 200, 400, 600, 800, 1000])
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
      root.render(createElement(MarbleDiagram, { player: createMarblePlayer(readMarbles(SOURCE)) }))
    })
    expect(host.querySelectorAll(".mb-lane")).toHaveLength(3)
    await act(async () => {
      root.render(createElement(MarbleDiagram, { player: createMarblePlayer(readMarbles("only : -a-a-|")) }))
    })
    expect([...host.querySelectorAll(".mb-lane")].map(row => row.getAttribute("data-lane"))).toEqual(["only"])
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
    const player = createMarblePlayer(readMarbles(SOURCE))
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
