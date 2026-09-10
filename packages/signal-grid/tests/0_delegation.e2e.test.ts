// Delegated routing asserted where it actually runs. A jsdom `dispatchEvent` proves the listener
// chain and nothing else: it never asks whether a real pointer at those coordinates reaches the
// element the route claims. Chromium hit-tests, so a cell that is not clickable fails here.
import type { Locator } from "playwright"
import { describe, expect, test } from "@hafley66/vitest-playwright"
import { beforeEach, inject } from "vitest"
import { selectorFor } from "../src/3_paths.js"

// A plain `vitest run` over the package collects this file too, with no serve slot and no browser.
// Skipping on the missing key keeps that run green rather than failing on a fixture nothing built.
// vitest 4 re-exports `ProvidedContext` from an internal chunk, so the plugin's `declare module
// "vitest"` block declares a second, empty interface and `inject` types every key as `never`.
const base = (inject as (key: string) => string | undefined)("vitest-playwright:baseURL")

const GRID = "files"
const ROW = "src/a.ts"
const COL = "size"
const ROWS = ["src/a.ts", "src/b.ts", "src/c.ts"] as const
const NO_MODS = { alt: false, ctrl: false, meta: false, shift: false, button: 0 }

interface Observed {
  route: "cell" | "header"
  params: Record<string, string>
  intent: unknown
}

type Fixture = { __events: Observed[]; __sharedStream: boolean }

const row = (rowId: string): Locator => $page.locator(selectorFor("row", { rowId }))
const cell = (rowId: string, colId: string): Locator =>
  row(rowId).locator(selectorFor("cell", { colId }))
const header = (colId: string): Locator => $page.locator(selectorFor("header", { colId }))

const events = (): Promise<Observed[]> =>
  $page.evaluate(() => (window as unknown as Fixture).__events)

const observed = (): Promise<string> => $page.locator("#observed").innerText()

describe.skipIf(base === undefined)("signal-grid delegation", () => {
  beforeEach(async () => {
    // A fresh load rather than a reset hook: the subscriptions are module level, so reloading is
    // the only way to be sure a stale one from the previous test is not still writing.
    await $page.goto(base as string)
    await expect($page.locator("html")).toHaveAttribute("data-fixture", "ready")
  })

  describe("relative delegation in chromium", () => {
    test("fills gridId and rowId from ancestors that a cell never repeats", async () => {
      await expect(cell(ROW, COL)).toHaveCount(1)
      await expect(cell(ROW, COL)).toHaveAttribute("data-route", "c")
      // The outer ids sit on the ancestors and nowhere else, which is the claim being tested.
      await expect(cell(ROW, COL)).not.toHaveAttribute("data-grid-id", /.*/)
      await expect(cell(ROW, COL)).not.toHaveAttribute("data-row-id", /.*/)

      await cell(ROW, COL).click()

      expect(await events()).toEqual([
        {
          route: "cell",
          params: { gridId: GRID, rowId: ROW, colId: COL },
          intent: { phase: "intent", type: "cell.click", row: ROW, col: COL, mods: NO_MODS },
        },
      ])
      expect(JSON.parse(await observed())).toEqual({ gridId: GRID, rowId: ROW, colId: COL })
    })

    test("reaches the cell route from a descendant of the cell", async () => {
      await cell(ROW, COL).locator(".label").click()

      expect((await events()).map(event => event.params)).toEqual([
        { gridId: GRID, rowId: ROW, colId: COL },
      ])
    })

    test("does not fire the cell route for an event raised on the row itself", async () => {
      // Subgrid tiles the row with its cells, so there is no longer a coordinate inside the row
      // and outside every cell. Raise the event on the row element directly instead, which is
      // what the chain rule is actually about: `g/r` must not resolve as `g/r/c`.
      await row(ROW).dispatchEvent("click")

      expect(await events()).toEqual([])
      expect(await observed()).toBe("")
    })

    test("turns the delegated event straight into a cell.click intent", async () => {
      await cell(ROW, COL).click({ modifiers: ["Shift"] })

      expect((await events()).map(event => event.intent)).toEqual([
        {
          phase: "intent",
          type: "cell.click",
          row: ROW,
          col: COL,
          mods: { alt: false, ctrl: false, meta: false, shift: true, button: 0 },
        },
      ])
    })

    test("a header click carries the grid and the column and no row", async () => {
      await header(COL).click()

      expect(await events()).toEqual([
        {
          route: "header",
          params: { gridId: GRID, colId: COL },
          intent: { phase: "intent", type: "header.click", col: COL, mods: NO_MODS },
        },
      ])
    })

    test("every row reports its own id through one shared stream", async () => {
      // The node-realm half of this lives in src/3_paths.test.ts; building the stream needs a
      // document, so the identity check runs in the page and is read back here.
      expect(await $page.evaluate(() => (window as unknown as Fixture).__sharedStream)).toBe(true)

      for (const rowId of ROWS) await cell(rowId, "name").click()

      expect((await events()).map(event => event.params.rowId)).toEqual([...ROWS])
    })
  })

  describe("selectorFor against a real query engine", () => {
    test("locates the elements the attrs helpers stamped", async () => {
      await expect($page.locator(selectorFor("grid", { gridId: GRID }))).toHaveCount(1)
      await expect($page.locator(selectorFor("row", { rowId: ROW }))).toHaveCount(1)
      await expect($page.locator(selectorFor("row"))).toHaveCount(3)
      await expect($page.locator(selectorFor("header", { colId: COL }))).toHaveCount(1)
      await expect($page.locator(selectorFor("cell", { colId: COL }))).toHaveCount(3)
      await expect($page.locator(selectorFor("cell"))).toHaveCount(6)
    })

    test("survives an id holding a slash, which css reads as a combinator unquoted", async () => {
      const selector = selectorFor("row", { rowId: ROW })
      expect(selector).toBe('[data-route="r"][data-row-id="src/a.ts"]')
      await expect($page.locator(selector)).toBeVisible()
    })
  })
})
