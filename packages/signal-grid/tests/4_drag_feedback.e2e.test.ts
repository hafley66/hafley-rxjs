// A real pointer, deferred gesture (`?drag=preview`): what the reader sees while the button is
// down. The guide line has to be on screen for a resize and for a column move, in the page and
// inside a modal <dialog>, which puts the grid in the top layer.
import { describe, expect, test } from "@hafley66/vitest-playwright"
import { beforeEach, inject } from "vitest"

const base = (inject as (key: string) => string | undefined)("vitest-playwright:baseURL")

const NAME_HANDLE = `.sg-head-cell[data-col-id="name"] [data-route="resize"]`
const NAME_GRIP = `.sg-head-cell[data-col-id="name"] [data-route="move"]`
const GUIDE = `[data-route="g"] .sg-guide`

type GuideShape = { axis: string | null; display: string; width: number; height: number; x: number; visible: boolean }

const guide = (): Promise<GuideShape> =>
  $page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement
    const rect = el.getBoundingClientRect()
    const style = getComputedStyle(el)
    // The topmost element at the line's own centre: something painted over it means it is hidden.
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
    return {
      axis: el.getAttribute("data-axis"),
      display: style.display,
      width: rect.width,
      height: rect.height,
      x: rect.left,
      visible: style.display !== "none" && rect.width > 0 && rect.height > 0 && hit !== null,
    }
  }, GUIDE)

const dragging = (): Promise<number> =>
  $page.evaluate(() => document.querySelectorAll('[data-dragging="true"]').length)

/** The cursor the browser shows at a point: read off the topmost element there. */
const cursorAt = (x: number, y: number): Promise<string> =>
  $page.evaluate(([px, py]) => {
    const el = document.elementFromPoint(px, py)
    return el === null ? "" : getComputedStyle(el).cursor
  }, [x, y] as const)

const handleInk = (): Promise<string> =>
  $page.evaluate((sel) => getComputedStyle(document.querySelector(sel) as HTMLElement, "::before").backgroundColor, NAME_HANDLE)

const dragAttrs = (): Promise<{ root: string | null; html: string | null }> =>
  $page.evaluate(() => ({
    root: document.querySelector('[data-route="g"]')?.getAttribute("data-sg-drag") ?? null,
    html: document.documentElement.getAttribute("data-sg-drag"),
  }))

const centreOf = async (selector: string): Promise<{ x: number; y: number }> => {
  const box = await $page.locator(selector).boundingBox()
  if (box === null) throw new Error(`${selector} has no box`)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/** Moves the mounted grid into a modal dialog. Same grid, same subscriptions, new stacking context. */
const intoDialog = (): Promise<void> =>
  $page.evaluate(() => {
    const mount = document.querySelector("#mount") as HTMLElement
    const dialog = document.createElement("dialog")
    dialog.style.inlineSize = "1000px"
    dialog.style.blockSize = "420px"
    dialog.style.padding = "16px"
    document.body.append(dialog)
    dialog.append(mount)
    dialog.showModal()
  })

const hosts = [
  { name: "page", prepare: async (): Promise<void> => {} },
  { name: "modal dialog", prepare: intoDialog },
]

describe.skipIf(base === undefined)("drag feedback with a real pointer", () => {
  beforeEach(async () => {
    await $page.goto(`${base as string}?columns=flex&drag=preview&move=1`)
    await expect($page.locator("html")).toHaveAttribute("data-fixture", "ready")
  })

  for (const host of hosts) {
    test(`resize: the guide line tracks the pointer in the ${host.name}`, async () => {
      await host.prepare()
      const grip = await centreOf(NAME_HANDLE)
      expect((await guide()).display).toBe("none")

      await $page.mouse.move(grip.x, grip.y)
      await $page.mouse.down()
      await $page.mouse.move(grip.x - 30, grip.y, { steps: 3 })
      const first = await guide()
      expect(first.axis).toBe("inline")
      expect(first.visible).toBe(true)
      expect(first.height).toBeGreaterThan(100)

      await $page.mouse.move(grip.x - 60, grip.y, { steps: 3 })
      const second = await guide()
      expect(second.x).toBeLessThan(first.x)
      // Sixty pixels left of a 6px handle is over the header label, and then over the row cells.
      expect(await cursorAt(grip.x - 60, grip.y)).toBe("col-resize")
      expect(await cursorAt(grip.x - 60, grip.y + 60)).toBe("col-resize")
      expect(await handleInk()).not.toBe("rgba(0, 0, 0, 0)")
      expect(await dragAttrs()).toEqual({ root: "colSize", html: "files" })
      await $page.screenshot({ path: `out/pw/drag-resize-${host.name.replace(" ", "-")}.png` })

      await $page.mouse.up()
      expect((await guide()).display).toBe("none")
      expect(await dragAttrs()).toEqual({ root: null, html: null })
      // The column now ends under the pointer, so the handle is hovered; step off it first.
      await $page.mouse.move(grip.x - 200, grip.y + 200)
      expect(await handleInk()).toBe("rgba(0, 0, 0, 0)")
    })

    test(`column move: the header dims and the guide marks the landing edge in the ${host.name}`, async () => {
      await host.prepare()
      const grip = await centreOf(NAME_GRIP)
      const target = await centreOf(`.sg-head-cell[data-col-id="size"]`)

      await $page.mouse.move(grip.x, grip.y)
      await $page.mouse.down()
      await $page.mouse.move(target.x + 20, grip.y, { steps: 5 })
      const shape = await guide()
      expect(shape.axis).toBe("inline")
      expect(shape.visible).toBe(true)
      expect(await dragging()).toBe(1)
      expect(await cursorAt(target.x + 20, grip.y)).toBe("grabbing")
      expect(await dragAttrs()).toEqual({ root: "colMove", html: "files" })
      await $page.screenshot({ path: `out/pw/drag-move-${host.name.replace(" ", "-")}.png` })

      await $page.mouse.up()
      expect(await dragging()).toBe(0)
      expect((await guide()).display).toBe("none")
    })
  }
})
