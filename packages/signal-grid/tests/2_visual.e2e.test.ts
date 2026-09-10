// Recorded proof. Five scenarios, each a real interaction in real chromium, each asserted on
// measured geometry and real DOM before and after every step, each filmed by playwright.
//
// The page under test is built here rather than read from fixtures/: fixtures/main.ts is the
// delegation receipt page, which hand-stamps divs and never calls `grid()` or `render()`. A vite
// lib build in `beforeAll` turns src/index.ts into one iife, so what the browser executes is the
// library's own source graph with no test double anywhere in it.
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { build } from "vite"
import { beforeAll, beforeEach, inject } from "vitest"
import { describe, expect, test } from "@hafley66/vitest-playwright"
import { colWidthVar, selectorFor } from "../src/3_paths.js"
import { beat, caption, cursor, step } from "./helpers/record.js"

// vitest 4 re-exports `ProvidedContext` from an internal chunk, so the plugin's `declare module`
// block lands on a second, empty interface and `inject` types every key as `never`.
const base = (inject as (key: string) => string | undefined)("vitest-playwright:baseURL")

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const SRC_INDEX = fileURLToPath(new URL("../src/index.ts", import.meta.url))
const SRC_GESTURES = fileURLToPath(new URL("../src/6_gestures.ts", import.meta.url))
const THEME_CSS = readFileSync(new URL("../src/theme.css", import.meta.url), "utf8")

const HOST = "#sg-host"
const GRID_ROOT = `${HOST}${selectorFor("grid", { gridId: "proof" })}`
const ROW = selectorFor("row")
const HEAD = selectorFor("header")
const CELL = selectorFor("cell")

// --- the page ---------------------------------------------------------------

const PAGE_CSS = `
html, body { margin: 0; color-scheme: light dark; font: 14px/1.4 system-ui, sans-serif;
  background: light-dark(#eef1f5, #05070a) }
#sg-host { position: absolute; inset-block-start: 28px; inset-inline: 28px; block-size: 620px;
  border: 1px solid light-dark(#c9cfd6, #2a2f36); border-radius: 8px; overflow: hidden }
`

// The bootstrap the browser runs. Two bare specifiers, both aliased by the inline plugin below to
// files in src/, because this text is written to a temp dir outside the package and node
// resolution from there would find neither the source nor its workspace peers.
const BOOTSTRAP = `
import { grid, gridDom, render, toGridSignal } from "sg-src"
import { drag } from "sg-gestures"

const WORDS = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel"]
const KINDS = ["file", "dir", "link"]

function flatRows(count) {
  const out = []
  for (let i = 0; i < count; i++) {
    out.push({
      id: "r" + i,
      name: WORDS[i % WORDS.length] + "-" + i,
      size: (i * 37) % 9973,
      kind: KINDS[i % KINDS.length],
      owner: WORDS[(i + 3) % WORDS.length],
      status: i % 2 === 0 ? "ok" : "stale",
    })
  }
  return out
}

function treeRows(parents, kids) {
  const out = []
  for (let p = 0; p < parents; p++) {
    const children = []
    for (let c = 0; c < kids; c++) {
      children.push({
        id: "p" + p + "-c" + c,
        name: "leaf " + c,
        size: c * 11,
        kind: "file",
        owner: WORDS[c % WORDS.length],
        status: "ok",
      })
    }
    out.push({
      id: "p" + p,
      name: "folder " + p,
      size: 0,
      kind: "dir",
      owner: "root",
      status: "ok",
      children,
    })
  }
  return out
}

let live = null

function change(type, value) {
  return { phase: "change", type, [type]: value }
}

function mount(config) {
  if (live !== null) {
    live.sub.unsubscribe()
    live.observer.disconnect()
    live.handle.stop()
  }
  // The served page is the delegation fixture, which carries its own [data-route="g"] tree. Left in
  // place it would answer every row and cell selector in this file.
  document.body.replaceChildren()
  const host = document.createElement("div")
  host.id = "sg-host"
  document.body.append(host)

  const tree = config.tree !== undefined
  const rows = tree ? treeRows(config.tree.parents, config.tree.kids) : flatRows(config.rows)
  const g = grid({
    id: config.id,
    rows,
    columns: config.columns,
    rowId: (row) => row.id,
    // 8_grid reads config.state only when it is a signal, so a plain seed object would be dropped.
    state: toGridSignal(config.state ?? {}, {}),
    subRows: tree ? (row) => row.children : undefined,
  })
  const handle = render(g, host)

  // grid() takes a viewport but subscribes to nothing that produces one: the scroll box belongs to
  // the consumer. Without this the plan sees extent 0 and virtualization renders an empty window.
  const scroll = host.querySelector(".sg-scroll")
  const sync = () => {
    g.viewport.$({
      top: scroll.scrollTop,
      left: scroll.scrollLeft,
      width: scroll.clientWidth,
      height: scroll.clientHeight,
    })
  }
  scroll.addEventListener("scroll", sync, { passive: true })
  const observer = new ResizeObserver(sync)
  observer.observe(scroll)

  // Column resize, wired from the parts the package already ships: the delegated pointerdown on
  // [data-route="resize"], 6_gestures' drag(), and one colWidth change per move. grid() builds no
  // epics of its own, so this glue is what a consumer writes today.
  const dom = gridDom(config.id)
  const sub = drag(dom.headerResize.route.pointerdown, {
    from: (down) => {
      if (down.params.gridId !== config.id) return null
      const width = g.view.widths.$().get(down.params.colId)
      if (width === undefined) return null
      down.preventDefault()
      return { col: down.params.colId, x0: down.clientX, w0: width }
    },
    move: (start, event) => resizeTo(g, start, event),
    commit: (start, event) => resizeTo(g, start, event),
  }).subscribe((action) => g.dispatch(action))

  live = { g, handle, host, scroll, sub, observer }
  sync()
  return true
}

function resizeTo(g, start, event) {
  const next = Math.max(40, Math.round(start.w0 + event.clientX - start.x0))
  return change("colWidth", { ...g.state.colWidth.$(), [start.col]: next })
}

window.__grid = {
  mount,
  set: (key, value) => {
    live.g.dispatch(change(key, value))
    return live.g.state[key].$()
  },
  get: (key) => live.g.state[key].$(),
  widths: () => Object.fromEntries(live.g.view.widths.$()),
  order: () => live.g.view.cols.$().map((node) => node.key),
  planned: () => live.g.view.plan.$().center.length,
  flat: () => live.g.view.flat.$().length,
  viewport: () => live.g.viewport.$(),
  scrollTo: (top) => {
    live.scroll.scrollTop = top
    return live.scroll.scrollTop
  },
}
document.documentElement.setAttribute("data-proof", "ready")
`

// --- the bundle -------------------------------------------------------------

let bundle = ""

async function buildBootstrap(): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), "sg-visual-"))
  const entry = join(dir, "entry.js")
  writeFileSync(entry, BOOTSTRAP)
  const result = await build({
    configFile: false,
    root: ROOT,
    mode: "production",
    logLevel: "warn",
    // immer, reached through @hafley66/signals, reads process.env.NODE_ENV at module scope. Nothing
    // in a lib build substitutes it, so without this the iife throws before it defines window.__grid.
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    plugins: [
      {
        name: "sg-visual-alias",
        resolveId: (id: string) =>
          id === "sg-src" ? SRC_INDEX : id === "sg-gestures" ? SRC_GESTURES : null,
      },
    ],
    build: {
      write: false,
      minify: false,
      target: "es2022",
      // iife, not es: an inline module script would have to resolve its imports against the served
      // origin, and the serve slot previews fixtures/dist, which holds neither src/ nor rxjs.
      lib: { entry, formats: ["iife"], name: "sgProof", fileName: "proof" },
    },
  })
  const output = Array.isArray(result) ? result[0].output : (result as { output: readonly unknown[] }).output
  const chunk = (output as readonly { type: string; code?: string }[]).find(part => part.type === "chunk")
  if (chunk?.code === undefined) throw new Error("vite produced no chunk for the visual bootstrap")
  return chunk.code
}

// --- page vocabulary --------------------------------------------------------

interface Box {
  readonly x: number
  readonly width: number
  readonly height: number
}

const rowCount = (): Promise<number> => $page.locator(ROW).count()

const headerOrder = (): Promise<string[]> =>
  $page.$$eval(HEAD, els => els.map(el => el.getAttribute("data-col-id") ?? ""))

const cellOrder = (): Promise<string[][]> =>
  $page.$$eval(ROW, rows =>
    rows.map(row =>
      [...row.querySelectorAll('[data-route="c"]')].map(cell => cell.getAttribute("data-col-id") ?? ""),
    ),
  )

const rowKeys = (): Promise<string[]> =>
  $page.$$eval(ROW, els => els.map(el => el.getAttribute("data-row-id") ?? ""))

const boxOf = (selector: string): Promise<Box> =>
  $page.evaluate(sel => {
    const el = document.querySelector(sel)
    if (el === null) throw new Error(`no element for ${sel}`)
    const r = el.getBoundingClientRect()
    const round = (n: number): number => Math.round(n * 100) / 100
    return { x: round(r.x), width: round(r.width), height: round(r.height) }
  }, selector)

const cssOf = (selector: string, prop: string): Promise<string> =>
  $page.evaluate(([sel, name]) => {
    const el = document.querySelector(sel)
    if (el === null) throw new Error(`no element for ${sel}`)
    return getComputedStyle(el).getPropertyValue(name).trim()
  }, [selector, prop] as const)

const setVar = (name: string, value: string): Promise<void> =>
  $page.evaluate(([sel, prop, next]) => {
    const el = document.querySelector(sel) as HTMLElement | null
    if (el === null) throw new Error(`no element for ${sel}`)
    el.style.setProperty(prop, next)
  }, [GRID_ROOT, name, value] as const)

const setState = (key: string, value: unknown): Promise<unknown> =>
  $page.evaluate(
    ([k, v]) => (window as unknown as { __grid: { set: (a: string, b: unknown) => unknown } }).__grid.set(k as string, v),
    [key, value] as const,
  )

const widths = (): Promise<Record<string, number>> =>
  $page.evaluate(() => (window as unknown as { __grid: { widths: () => Record<string, number> } }).__grid.widths())

const planned = (): Promise<number> =>
  $page.evaluate(() => (window as unknown as { __grid: { planned: () => number } }).__grid.planned())

const flatCount = (): Promise<number> =>
  $page.evaluate(() => (window as unknown as { __grid: { flat: () => number } }).__grid.flat())

interface GridConfig {
  readonly id: string
  readonly rows?: number
  readonly tree?: { readonly parents: number; readonly kids: number }
  readonly columns: readonly Record<string, unknown>[]
  readonly state?: Record<string, unknown>
}

async function mountGrid(config: GridConfig): Promise<void> {
  await $page.evaluate(
    cfg => (window as unknown as { __grid: { mount: (c: unknown) => boolean } }).__grid.mount(cfg),
    config,
  )
  await expect($page.locator(GRID_ROOT)).toHaveCount(1)
  // The mount clears the body, so the drawn cursor is reinstalled after it, never before.
  await cursor($page)
}

const COLS = {
  name: { id: "name", header: "Name", width: 220, resizable: true },
  size: { id: "size", header: "Size", width: 120, resizable: true },
  kind: { id: "kind", header: "Kind", width: 140, resizable: true },
  owner: { id: "owner", header: "Owner", width: 160, resizable: true },
} as const

/** Numbers the report quotes. Written by the scenarios, printed once at the end of the run. */
const measured: Record<string, unknown> = {}

// --- the run ----------------------------------------------------------------

describe.skipIf(base === undefined)("signal-grid on video", () => {
  beforeAll(async () => {
    bundle = await buildBootstrap()
  })

  beforeEach(async () => {
    await $page.goto(base as string)
    await $page.addStyleTag({ content: `${THEME_CSS}\n${PAGE_CSS}` })
    await $page.addScriptTag({ content: bundle })
    await expect($page.locator("html")).toHaveAttribute("data-proof", "ready")
  })

  test("css custom properties on the grid root retheme live rows, and light-dark flips with the color scheme", async () => {
    await mountGrid({
      id: "proof",
      tree: { parents: 3, kids: 4 },
      columns: [COLS.name, COLS.size, COLS.kind],
      state: { expanded: { p0: true } },
    })
    const child = `${ROW}[data-row-id="p0-c0"]`
    const parent = `${ROW}[data-row-id="p0"]`

    await caption($page, "1/5 css customization: the theme's own custom properties, at run time")
    await beat($page)

    // Before: the defaults theme.css declares, measured rather than assumed.
    await expect($page.locator(child)).toHaveCount(1)
    const baseRow = await boxOf(parent)
    const baseIndent = await cssOf(`${child} .sg-expander`, "margin-inline-start")
    expect(baseRow.height).toBe(36)
    expect(baseIndent).toBe("16px")
    measured.themeBaselineRowHeight = baseRow.height
    measured.themeBaselineIndent = baseIndent

    await step($page, "set --sg-row-h to 52px and --sg-indent to 40px on the grid root", async () => {
      await setVar("--sg-row-h", "52px")
      await setVar("--sg-indent", "40px")
    })
    const tallRow = await boxOf(parent)
    expect(tallRow.height).toBe(52)
    expect(await cssOf(`${child} .sg-expander`, "margin-inline-start")).toBe("40px")
    measured.themeOverriddenRowHeight = tallRow.height
    measured.themeOverriddenIndent = "40px"

    await step($page, "set the selection accent to rgb(255, 64, 129) and select one row", async () => {
      await setVar("--sg-selected-bg", "rgb(255, 64, 129)")
      await setState("rowSelection", { p0: true })
    })
    await expect($page.locator(parent)).toHaveAttribute("data-selected", "true")
    expect(await cssOf(parent, "background-color")).toBe("rgb(255, 64, 129)")
    expect(await cssOf(child, "background-color")).toBe("rgb(255, 255, 255)")

    await step($page, "switch the preferred color scheme to dark: light-dark() re-resolves", async () => {
      await $page.emulateMedia({ colorScheme: "dark" })
    })
    const darkBg = await cssOf(GRID_ROOT, "background-color")
    const darkFg = await cssOf(GRID_ROOT, "color")
    expect(darkBg).toBe("rgb(20, 22, 26)")
    expect(darkFg).toBe("rgb(230, 232, 234)")
    expect(await cssOf(child, "background-color")).toBe("rgb(20, 22, 26)")
    measured.darkBackground = darkBg
    measured.darkForeground = darkFg

    await step($page, "back to light: the same declarations resolve to the other pair", async () => {
      await $page.emulateMedia({ colorScheme: "light" })
    })
    const lightBg = await cssOf(GRID_ROOT, "background-color")
    expect(lightBg).toBe("rgb(255, 255, 255)")
    expect(await cssOf(GRID_ROOT, "color")).toBe("rgb(26, 28, 31)")
    measured.lightBackground = lightBg

    // --sg-row-h has two writers: theme.css and 9_css.ts, which writes it inline from density on
    // every geometry frame. A density change is therefore what takes the override back.
    await step($page, "density compact: the renderer reclaims --sg-row-h from the override", async () => {
      await setState("density", "compact")
    })
    const compact = await boxOf(parent)
    expect(compact.height).toBe(28)
    expect(await cssOf(GRID_ROOT, "--sg-row-h")).toBe("28px")
    measured.compactRowHeight = compact.height
  })

  test("dragging the resize handle with a real pointer widens one column and leaves its neighbours alone", async () => {
    await mountGrid({
      id: "proof",
      rows: 40,
      columns: [COLS.name, COLS.size, COLS.kind, COLS.owner],
    })
    const handle = `${HEAD}[data-col-id="size"] [data-route="resize"]`
    const sizeCell = `${ROW}[data-row-id="r0"] ${CELL}[data-col-id="size"]`
    const nameCell = `${ROW}[data-row-id="r0"] ${CELL}[data-col-id="name"]`
    const kindCell = `${ROW}[data-row-id="r0"] ${CELL}[data-col-id="kind"]`

    await caption($page, "2/5 column resize: pointerdown on the handle, six moves, pointerup")
    await beat($page)

    const beforeSize = await boxOf(sizeCell)
    const beforeName = await boxOf(nameCell)
    const beforeKind = await boxOf(kindCell)
    expect(beforeSize.width).toBe(120)
    expect(beforeName.width).toBe(220)
    expect(beforeKind.width).toBe(140)

    const grip = await $page.locator(handle).boundingBox()
    if (grip === null) throw new Error("the resize handle has no box, so the column is not resizable")
    const y = grip.y + grip.height / 2
    const x0 = grip.x + grip.width / 2

    await caption($page, "pointer down on [data-route=\"resize\"] of the Size column")
    await $page.mouse.move(x0, y)
    await beat($page, 300)
    await $page.mouse.down()
    await beat($page, 200)

    // Six moves rather than one: a single jump records as a cut, and the intermediate frames are
    // what show the column tracking the pointer.
    const during: number[] = []
    for (let i = 1; i <= 6; i++) {
      await $page.mouse.move(x0 + i * 20, y)
      await beat($page, 120)
      during.push((await boxOf(sizeCell)).width)
    }
    expect(during).toEqual([140, 160, 180, 200, 220, 240])
    expect((await boxOf(nameCell)).width).toBe(beforeName.width)
    expect((await boxOf(nameCell)).x).toBe(beforeName.x)
    expect((await boxOf(kindCell)).width).toBe(beforeKind.width)
    measured.resizeDuringDrag = during

    await caption($page, "pointer up: the width holds because it is state, not a style mutation")
    await $page.mouse.up()
    await beat($page)

    const afterSize = await boxOf(sizeCell)
    expect(afterSize.width).toBe(240)
    expect((await widths()).size).toBe(240)
    expect(await cssOf(GRID_ROOT, colWidthVar("size"))).toBe("240px")
    expect((await boxOf(nameCell)).width).toBe(220)
    expect((await boxOf(nameCell)).x).toBe(beforeName.x)
    expect((await boxOf(kindCell)).width).toBe(140)
    // The header band and the row band read the same property, so one write moved both.
    expect((await boxOf(`${HEAD}[data-col-id="size"]`)).width).toBe(240)
    measured.resizeAfterRelease = afterSize.width
    measured.resizeNeighbourWidths = { name: 220, kind: 140 }
  })

  test("5000 rows recycle through a bounded DOM, and turning virtualization off renders the whole page", async () => {
    await mountGrid({
      id: "proof",
      rows: 5000,
      columns: [COLS.name, COLS.size, COLS.kind],
    })

    await caption($page, "3/5 virtualization: 5000 rows in the model")
    await beat($page)

    expect(await flatCount()).toBe(5000)
    const first = await rowCount()
    expect(first).toBeGreaterThan(0)
    expect(first).toBeLessThan(60)
    // plan.center is the windowed run, so the model and the document agree on what exists.
    expect(await planned()).toBe(first)

    const counts: number[] = [first]
    const heads: string[] = [(await rowKeys())[0] ?? ""]

    // A real wheel over the scroll box for the first three steps, so the video shows rows entering
    // and leaving rather than a cut. The last step jumps to the far end, which no wheel budget
    // reaches: 5000 rows at 36px is 180000px of scroll spacer.
    await $page.mouse.move(700, 400)
    for (const phase of [1, 2, 3]) {
      await step($page, `wheel ${phase} of 3: rows recycle, the DOM count does not grow`, async () => {
        for (let tick = 0; tick < 6; tick++) {
          await $page.mouse.wheel(0, 340)
          await beat($page, 90)
        }
      })
      const keys = await rowKeys()
      counts.push(keys.length)
      heads.push(keys[0] ?? "")
      expect(keys.length).toBeLessThan(60)
    }
    const bottom = await step($page, "jump to the far end of the 180000px scroll spacer", async () =>
      $page.evaluate(
        y => (window as unknown as { __grid: { scrollTo: (n: number) => number } }).__grid.scrollTo(y),
        // Beyond scrollHeight on purpose: the box clamps, which is how the test names the far end
        // without restating the spacer arithmetic.
        1_000_000,
      ),
    )
    expect(bottom).toBeGreaterThan(170_000)
    const tail = await rowKeys()
    counts.push(tail.length)
    heads.push(tail[0] ?? "")
    expect(tail.length).toBeLessThan(60)
    expect(tail).toContain("r4999")
    // Every step landed on a different first key, which is the recycling claim.
    expect(new Set(heads).size).toBe(heads.length)
    expect(Math.max(...counts)).toBeLessThan(60)
    measured.virtualRowCounts = counts
    measured.virtualFirstKeys = heads

    await step($page, "state.virtualize.vertical = false: the same model renders every row", async () => {
      await setState("virtualize", { vertical: false, horizontal: false })
    })
    const full = await rowKeys()
    expect(full).toHaveLength(5000)
    expect(await planned()).toBe(5000)
    expect(full[0]).toBe("r0")
    expect(full[4999]).toBe("r4999")
    measured.unvirtualizedRowCount = full.length

    await step($page, "state.virtualize.vertical = true: back to a bounded window", async () => {
      await setState("virtualize", { vertical: true, horizontal: false })
    })
    const rebounded = await rowKeys()
    expect(rebounded.length).toBeLessThan(60)
    // The scroll box never moved, so the window resumes on the key it was showing.
    expect(rebounded[0]).toBe(heads[heads.length - 1])
    measured.reboundedRowCount = rebounded.length
    measured.reboundedFirstKey = rebounded[0]
  })

  test("state.colOrder drives the header band and every row band from one model", async () => {
    await mountGrid({
      id: "proof",
      rows: 12,
      columns: [COLS.name, COLS.size, COLS.kind, COLS.owner],
      state: { colOrder: ["name", "size", "kind", "owner"] },
    })

    await caption($page, "4/5 column order: one array, two bands")
    await beat($page)

    const schema = ["name", "size", "kind", "owner"]
    expect(await headerOrder()).toEqual(schema)
    const startCells = await cellOrder()
    expect(startCells).toHaveLength(12)
    for (const row of startCells) expect(row).toEqual(schema)

    const swapped = ["kind", "owner", "name", "size"]
    await step($page, `state.colOrder = ${JSON.stringify(swapped)}`, async () => {
      await setState("colOrder", swapped)
    })
    expect(await headerOrder()).toEqual(swapped)
    const swappedCells = await cellOrder()
    expect(swappedCells).toHaveLength(12)
    for (const row of swappedCells) expect(row).toEqual(swapped)

    // First column to last. The header alone could be explained by a header-only sort; the row band
    // following the same array in the same tick is what rules that out.
    const rotated = ["owner", "name", "size", "kind"]
    await step($page, `first column to last: state.colOrder = ${JSON.stringify(rotated)}`, async () => {
      await setState("colOrder", rotated)
    })
    expect(await headerOrder()).toEqual(rotated)
    const rotatedCells = await cellOrder()
    expect(rotatedCells).toHaveLength(12)
    for (const row of rotatedCells) expect(row).toEqual(rotated)
    expect(await $page.evaluate(() => (window as unknown as { __grid: { order: () => string[] } }).__grid.order())).toEqual(rotated)
    measured.colOrderPermutations = [schema, swapped, rotated]
  })

  test("hiding a column removes it from both bands and reflows the rest, and unhiding returns it to its rank", async () => {
    await mountGrid({
      id: "proof",
      rows: 12,
      columns: [
        { id: "name", header: "Name", flex: 2, minWidth: 120 },
        { id: "size", header: "Size", flex: 1, minWidth: 80 },
        { id: "kind", header: "Kind", flex: 1, minWidth: 80 },
        { id: "owner", header: "Owner", flex: 1, minWidth: 80 },
      ],
      state: { colOrder: ["name", "size", "kind", "owner"] },
    })

    await caption($page, "5/5 column visibility: flex columns reflow into the freed width")
    await beat($page)

    const all = ["name", "size", "kind", "owner"]
    expect(await headerOrder()).toEqual(all)
    const before = await widths()
    expect(Object.keys(before).sort()).toEqual([...all].sort())
    const beforeName = (await boxOf(`${HEAD}[data-col-id="name"]`)).width
    const beforeSize = (await boxOf(`${HEAD}[data-col-id="size"]`)).width
    expect(await $page.locator(`${CELL}[data-col-id="kind"]`).count()).toBe(12)

    await step($page, 'state.colHidden = { kind: true }', async () => {
      await setState("colHidden", { kind: true })
    })
    expect(await headerOrder()).toEqual(["name", "size", "owner"])
    // Gone from the header band and from every row band, not merely from the header.
    await expect($page.locator(`${HEAD}[data-col-id="kind"]`)).toHaveCount(0)
    await expect($page.locator(`${CELL}[data-col-id="kind"]`)).toHaveCount(0)
    for (const row of await cellOrder()) expect(row).toEqual(["name", "size", "owner"])

    const after = await widths()
    expect(Object.keys(after).sort()).toEqual(["name", "owner", "size"])
    const afterName = (await boxOf(`${HEAD}[data-col-id="name"]`)).width
    const afterSize = (await boxOf(`${HEAD}[data-col-id="size"]`)).width
    expect(afterName).toBeGreaterThan(beforeName)
    expect(afterSize).toBeGreaterThan(beforeSize)
    // flex 2 : 1 : 1 over the same available width, so the freed share splits in the same ratio.
    expect(Math.round(afterName / afterSize)).toBe(2)
    measured.visibilityWidths = {
      before: { name: beforeName, size: beforeSize },
      afterHide: { name: afterName, size: afterSize },
    }

    await step($page, "state.colHidden = {}: the column comes back at rank 2, not at the end", async () => {
      await setState("colHidden", {})
    })
    const restored = await headerOrder()
    expect(restored).toEqual(all)
    expect(restored.indexOf("kind")).toBe(2)
    for (const row of await cellOrder()) expect(row).toEqual(all)
    await expect($page.locator(`${CELL}[data-col-id="kind"]`)).toHaveCount(12)
    const back = await widths()
    expect(Math.round(back.name ?? 0)).toBe(Math.round(before.name ?? 0))
    expect(Math.round(back.size ?? 0)).toBe(Math.round(before.size ?? 0))
    measured.visibilityRestoredIndex = restored.indexOf("kind")
    measured.visibilityWidthsRestored = back

    // One line the report copies from, rather than five reruns to recover the same numbers.
    console.log("VISUAL-MEASURED " + JSON.stringify(measured))
  })
})
