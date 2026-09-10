// Runs in chromium under `vitest.browser.config.ts`, because the claim is about what a real engine
// keeps in the document while a real scroller moves, which no simulated document can answer.
import { describe, expect, it } from "vitest"
import "../src/theme.css"
import type { Grid } from "../src/index.js"
import { COL_COUNT, ROW_COUNT, sheetDemo, type SheetRow } from "./5_sheet.js"
import type { DemoHandle, DemoHosts } from "./0_shell.js"

/** At this viewport the window measures 22 rows by 14 columns, so 308 cells stand in for
 * 240,000,000. The bound is loose on purpose: what fails is a run that grew with the model. */
const CELL_BOUND = 1_200

const VIEW = { width: 900, height: 500 }

const nextFrame = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => resolve())
  })

interface Mounted {
  readonly handle: DemoHandle
  readonly stage: HTMLElement
  readonly scroll: HTMLElement
  readonly cells: () => number
  readonly rowKeys: () => readonly string[]
  readonly release: () => void
}

const boxOf = (className: string, styles: Readonly<Record<string, string>> = {}): HTMLElement => {
  const el = document.createElement("div")
  el.className = className
  for (const [name, value] of Object.entries(styles)) el.style.setProperty(name, value)
  return el
}

const mountSheet = async (): Promise<Mounted> => {
  const shell = boxOf("demo")
  const panel = boxOf("panel")
  const readout = boxOf("readout")
  const stage = boxOf("stage", {
    "inline-size": `${VIEW.width}px`,
    "block-size": `${VIEW.height}px`,
  })
  shell.append(panel, stage, readout)
  document.body.append(shell)

  const hosts: DemoHosts = { shell, panel, stage, readout }
  const handle = sheetDemo.mount(hosts)
  const scroll = stage.querySelector(".sg-scroll") as HTMLElement

  for (let tick = 0; tick < 60 && stage.getElementsByClassName("sg-row").length === 0; tick++) {
    await nextFrame()
  }

  return {
    handle,
    stage,
    scroll,
    cells: () => stage.getElementsByClassName("sg-cell").length,
    rowKeys: () =>
      Array.from(stage.getElementsByClassName("sg-row")).map(
        (it) => it.getAttribute("data-row-id") ?? it.getAttribute("data-row") ?? "",
      ),
    release: () => {
      handle.stop()
      shell.remove()
    },
  }
}

/** One scroll frame the way the browser delivers it: write the box, tell the listener, let the
 * plan and the DOM pass that follows it land. */
const scrollTo = async (view: Mounted, top: number, left: number): Promise<void> => {
  view.scroll.scrollTop = top
  view.scroll.scrollLeft = left
  view.scroll.dispatchEvent(new Event("scroll"))
  await nextFrame()
  await nextFrame()
}

// The corners and the middle, down and sideways, so no step reuses the previous window.
const STOPS: readonly (readonly [number, number])[] = [
  [0, 0],
  [28_000, 0],
  [7_000_000, 4_000],
  [14_000_000, 12_000],
  [27_999_999, 23_040],
  [13_000_000, 900],
  [0, 23_040],
  [0, 0],
]

describe("the million-row sheet keeps a bounded document while it is scrolled hard", () => {
  it("holds the whole relation in the model and a window of it in the document", async () => {
    const view = await mountSheet()
    const sheet = view.handle.grid as Grid<SheetRow>

    expect(sheet.view.flat.$().length).toBe(ROW_COUNT)
    expect(sheet.columns.$().length).toBe(COL_COUNT)
    expect(sheet.state.virtualize.$()).toEqual({ vertical: true, horizontal: true })

    const drawn = view.cells()
    expect(drawn).toBeGreaterThan(0)
    expect(drawn).toBeLessThan(CELL_BOUND)
    expect(sheet.view.colPlan.$().center.length).toBeLessThan(COL_COUNT)

    view.release()
  })

  it("stays inside that bound at every stop of a hard scroll, and moves while it does", async () => {
    const view = await mountSheet()
    const counts: number[] = []
    const heads: string[] = []

    for (const [top, left] of STOPS) {
      await scrollTo(view, top, left)
      const drawn = view.cells()
      expect(drawn).toBeGreaterThan(0)
      expect(drawn).toBeLessThan(CELL_BOUND)
      counts.push(drawn)
      heads.push(view.rowKeys()[0] ?? "")
    }

    // Six of the eight stops are distinct scroll positions, so the window has to have moved off its
    // first key more than once. The two repeats are the two returns to the top.
    expect(new Set(heads).size).toBeGreaterThan(4)
    expect(Math.max(...counts)).toBeLessThan(CELL_BOUND)

    view.release()
  })

  it("turning the horizontal seat off puts every column back, and the row window holds", async () => {
    const view = await mountSheet()
    const sheet = view.handle.grid as Grid<SheetRow>

    const windowed = sheet.view.colPlan.$().center.length
    sheet.state.virtualize.horizontal.$(false)
    await nextFrame()
    await nextFrame()

    expect(sheet.view.colPlan.$().center).toHaveLength(COL_COUNT)
    expect(windowed).toBeLessThan(COL_COUNT)
    expect(sheet.view.plan.$().center.length).toBeLessThan(200)

    view.release()
  })
})
