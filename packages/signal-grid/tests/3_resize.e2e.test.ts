// A drag, with a real pointer, on a column the schema sized by flex. `1_render.e2e.test.ts` covers
// the fixed schema, where a resize writes a width no other declaration competes with. A flex column
// carries three more numbers, and what this file asserts is a box: the cells of the dragged column
// have to land on the width the commit wrote, or the state moved and the screen did not.
import { describe, expect, test } from "@hafley66/vitest-playwright"
import { beforeEach, inject } from "vitest"
import { selectorFor } from "../src/3_paths.js"
import { SG_INLINE_TRACKS } from "../src/9_css.js"

// vitest 4 re-exports `ProvidedContext` from an internal chunk, so the plugin's `declare module`
// block declares a second, empty interface and `inject` types every key as `never`.
const base = (inject as (key: string) => string | undefined)("vitest-playwright:baseURL")

const ROW = selectorFor("row")
const NAME_HEAD = `.sg-head-cell[data-col-id="name"]`
const NAME_HANDLE = `${NAME_HEAD} [data-route="resize"]`
const NAME_CELLS = selectorFor("cell", { colId: "name" })

// fixtures/main.ts reads this and mounts `name` as flex 2, minWidth 180, maxWidth 320.
const FLEX_PAGE = "?columns=flex"

const widthsIn = (selector: string): Promise<number[]> =>
  $page.evaluate(
    (sel) =>
      Array.from(document.querySelectorAll(sel)).map(
        (el) => Math.round(el.getBoundingClientRect().width * 100) / 100,
      ),
    selector,
  )

const tracks = (): Promise<string> =>
  $page.evaluate((name) => {
    const root = document.querySelector(`[data-route="g"]`)
    return root === null ? "" : getComputedStyle(root).getPropertyValue(name).trim()
  }, SG_INLINE_TRACKS)

type Fixture = { __grid: { state: { colWidth: { $: () => Record<string, number> } } } }

const declaredWidth = (): Promise<number | null> =>
  $page.evaluate(() => {
    const fixture = window as unknown as Fixture
    return fixture.__grid.state.colWidth.$()["name"] ?? null
  })

/** The handle's centre, which is where a pointer that grabbed it would be. */
const gripAt = async (): Promise<{ x: number; y: number }> => {
  const box = await $page.locator(NAME_HANDLE).boundingBox()
  if (box === null) throw new Error("the name column has no resize handle, so it is not resizable")
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

describe.skipIf(base === undefined)("signal-grid flex column resize", () => {
  beforeEach(async () => {
    await $page.goto(`${base as string}${FLEX_PAGE}`)
    await expect($page.locator("html")).toHaveAttribute("data-fixture", "ready")
    await expect($page.locator(`.sg-center ${ROW}`)).toHaveCount(3)
  })

  test("drags a flex column narrower and every cell in it lands on the committed width", async () => {
    // At rest the schema owns the sizing: no width is declared, so the track is the flex one.
    expect(await declaredWidth()).toBe(null)
    const [resting] = await widthsIn(NAME_CELLS)
    expect(resting).toBe(320)
    expect(await widthsIn(NAME_HEAD)).toEqual([320])

    const grip = await gripAt()
    await $page.mouse.move(grip.x, grip.y)
    await $page.mouse.down()

    // Four moves rather than one jump: a cell that only agrees at the commit is a cell that was
    // snapping to a declaration it read somewhere other than the drag.
    const during: number[] = []
    for (const delta of [-20, -40, -60, -80]) {
      await $page.mouse.move(grip.x + delta, grip.y)
      const [width] = await widthsIn(NAME_CELLS)
      during.push(width as number)
    }
    expect(during).toEqual([300, 280, 260, 240])

    await $page.mouse.up()

    expect(await declaredWidth()).toBe(240)
    expect(await widthsIn(NAME_CELLS)).toEqual([240, 240, 240])
    expect(await widthsIn(NAME_HEAD)).toEqual([240])
    // One fixed track, so nothing downstream can resolve the column to some other number.
    expect(await tracks()).toBe("240px 100px")
  })

  test("holds the schema's floor when the pointer goes past it", async () => {
    const grip = await gripAt()
    await $page.mouse.move(grip.x, grip.y)
    await $page.mouse.down()
    await $page.mouse.move(grip.x - 400, grip.y)
    await $page.mouse.up()

    expect(await declaredWidth()).toBe(180)
    expect(await widthsIn(NAME_CELLS)).toEqual([180, 180, 180])
    expect(await tracks()).toBe("180px 100px")
  })
})
