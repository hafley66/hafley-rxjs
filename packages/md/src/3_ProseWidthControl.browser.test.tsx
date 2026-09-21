import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { installMdviewHost, type MdviewHost } from "./ports.js"
import {
  loadPersistedMdUi,
  mdUi,
  proseWidthFor,
} from "./signals.js"
import { ProseWidthControl } from "./3_ProseWidthControl.js"

let saved: Record<string, unknown>
let saveCount = 0
let root: Root | undefined
let container: HTMLDivElement | undefined

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event("input", { bubbles: true }))
  input.dispatchEvent(new Event("change", { bubbles: true }))
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  saved = {
    proseWidth: 900,
    proseWidths: {},
    proseWidthMin: 420,
    proseWidthMax: 1200,
  }
  saveCount = 0
  installMdviewHost({
    readPluginState: () => saved,
    savePluginState: (_pluginId: string, patch: Partial<Record<string, unknown>>) => {
      saveCount += 1
      saved = { ...saved, ...patch }
    },
  } as unknown as MdviewHost)
  mdUi.$({
    ...mdUi.$(),
    proseWidth: 900,
    proseWidths: {},
    proseWidthMin: 420,
    proseWidthMax: 1200,
  })
  container = document.createElement("div")
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  if (root) await act(() => root!.unmount())
  container?.remove()
  root = undefined
  container = undefined
})

describe("ProseWidthControl", () => {
  it("drafts editable bounds, commits on blur, and persists a panel width", async () => {
    await act(() => root!.render(<ProseWidthControl pid="md:guide" />))
    const min = container!.querySelector<HTMLInputElement>("[aria-label='Minimum prose width in pixels']")!
    const slider = container!.querySelector<HTMLInputElement>("input[aria-label='Prose reading width']")!

    await act(() => {
      min.focus()
      setInputValue(min, "500")
    })
    expect(min.value).toBe("500")
    expect(mdUi.$().proseWidthMin).toBe(420)

    await act(() => min.blur())
    expect(mdUi.$().proseWidthMin).toBe(500)

    const width = container!.querySelector<HTMLInputElement>("[aria-label='Prose width in pixels']")!
    await act(() => {
      width.focus()
      setInputValue(width, "1075")
    })
    expect(width.value).toBe("1075")
    expect(proseWidthFor("md:guide")).toBe(900)
    await act(() => width.blur())
    expect(proseWidthFor("md:guide")).toBe(1075)

    await act(() => setInputValue(slider, "1050"))
    expect(proseWidthFor("md:guide")).toBe(1050)
    expect(saved).toMatchObject({
      proseWidth: 1050,
      proseWidths: { "md:guide": 1050 },
    })
  })

  it("restores the panel width after a remount and reset writes the global default", async () => {
    await act(() => root!.render(<ProseWidthControl pid="md:guide" />))
    const slider = container!.querySelector<HTMLInputElement>("input[aria-label='Prose reading width']")!
    await act(() => setInputValue(slider, "1080"))
    expect(proseWidthFor("md:guide")).toBe(1080)

    await act(() => root!.unmount())
    root = createRoot(container!)
    mdUi.$({ ...mdUi.$(), proseWidth: 900, proseWidths: {} })
    loadPersistedMdUi()
    await act(() => root!.render(<ProseWidthControl pid="md:guide" />))
    expect(container!.querySelector<HTMLInputElement>("input[aria-label='Prose reading width']")!.value).toBe("1080")

    await act(() => (container!.querySelector<HTMLButtonElement>("[aria-label='Reset prose width']")!).click())
    expect(proseWidthFor("md:guide")).toBe(900)
    expect(saved).toMatchObject({ proseWidth: 900, proseWidths: { "md:guide": 900 } })
  })

  it("commits each numeric field once when Enter blurs the field", async () => {
    await act(() => root!.render(<ProseWidthControl pid="md:guide" />))
    const width = container!.querySelector<HTMLInputElement>("[aria-label='Prose width in pixels']")!
    const before = saveCount

    await act(() => {
      width.focus()
      setInputValue(width, "1075")
      width.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
    })

    expect(saveCount - before).toBe(1)
    expect(proseWidthFor("md:guide")).toBe(1075)
  })
})
