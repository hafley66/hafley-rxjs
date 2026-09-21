import { afterEach, beforeEach, expect, it } from "vitest"
import { grid } from "./8_grid.js"
import { render, type RenderHandle } from "./10_render.js"

type Entry = {
  readonly target: Element
  readonly contentRect: { readonly width: number; readonly height: number }
  readonly borderBoxSize?: readonly { readonly inlineSize: number; readonly blockSize: number }[]
}

class ResizeStub {
  static instances: ResizeStub[] = []
  readonly targets = new Set<Element>()
  constructor(readonly notify: (entries: readonly Entry[]) => void) {
    ResizeStub.instances.push(this)
  }
  observe(target: Element): void { this.targets.add(target) }
  unobserve(target: Element): void { this.targets.delete(target) }
  disconnect(): void { this.targets.clear() }
  emit(entries: readonly Entry[]): void { this.notify(entries) }
}

class IntersectionStub {
  constructor() {}
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

let live: { readonly handle: RenderHandle; readonly close: () => void } | undefined
let nativeResizeObserver: typeof ResizeObserver
let nativeIntersectionObserver: typeof IntersectionObserver

beforeEach(() => {
  nativeResizeObserver = globalThis.ResizeObserver
  nativeIntersectionObserver = globalThis.IntersectionObserver
  ResizeStub.instances = []
  globalThis.ResizeObserver = ResizeStub as unknown as typeof ResizeObserver
  globalThis.IntersectionObserver = IntersectionStub as unknown as typeof IntersectionObserver
})

afterEach(() => {
  live?.handle.stop()
  live?.close()
  live = undefined
  globalThis.ResizeObserver = nativeResizeObserver
  globalThis.IntersectionObserver = nativeIntersectionObserver
})

const nextFrame = async (): Promise<void> => {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

it("feeds border-box row measurements into the sizer and permits a later shrink", async () => {
  const host = document.createElement("div")
  document.body.append(host)
  const made = grid({
    id: "measure-test",
    rows: [{ id: "row-0", text: "wrapped" }],
    columns: [{ id: "text", header: "Text", value: (row: { readonly text: string }) => row.text }],
    rowId: (row: { readonly id: string }) => row.id,
    rowMeasure: { initial: 36 },
    state: { virtualize: { vertical: false, horizontal: false } },
    viewport: { top: 0, left: 0, width: 500, height: 300 },
  })
  const handle = render(made, host)
  live = { handle, close: made.close }
  const row = host.querySelector<HTMLElement>('[data-row-id="row-0"]')
  expect(row).not.toBeNull()
  const measureObserver = ResizeStub.instances[0]
  expect(measureObserver).not.toBeUndefined()

  measureObserver!.emit([{
    target: row!,
    contentRect: { width: 500, height: 80 },
    borderBoxSize: [{ inlineSize: 500, blockSize: 82 }],
  }])
  await nextFrame()
  expect(made.state.rowHeight.$()["row-0"]).toBe(82)
  expect(host.style.getPropertyValue("--sg-total-h")).toBe("82px")
  expect(row!.style.getPropertyValue("--sg-h")).toBe("")

  measureObserver!.emit([{
    target: row!,
    contentRect: { width: 500, height: 38 },
    borderBoxSize: [{ inlineSize: 500, blockSize: 40 }],
  }])
  await nextFrame()
  expect(made.state.rowHeight.$()["row-0"]).toBe(40)
  expect(host.style.getPropertyValue("--sg-total-h")).toBe("40px")
})
