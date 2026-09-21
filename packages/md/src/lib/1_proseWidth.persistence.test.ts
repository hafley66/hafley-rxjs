import { describe, expect, it } from "vitest"
import { installMdviewHost, type MdviewHost } from "../ports.js"
import {
  loadPersistedMdUi,
  mdUi,
  proseWidthFor,
  setProseWidthFor,
  setProseWidthBounds,
} from "../signals.js"

describe("persisted prose width", () => {
  it("restores a panel override after the panel state is rebuilt", () => {
    let saved: Record<string, unknown> = {}
    installMdviewHost({
      readPluginState: () => saved,
      savePluginState: (_pluginId: string, patch: Partial<Record<string, unknown>>) => {
        saved = { ...saved, ...patch }
      },
    } as unknown as MdviewHost)

    setProseWidthFor("md:guide", 1040)
    expect(saved.proseWidth).toBe(1040)
    expect(proseWidthFor("md:guide")).toBe(1040)

    mdUi.$({ ...mdUi.$(), proseWidth: 900, proseWidths: {} })
    loadPersistedMdUi()
    expect(proseWidthFor("md:guide")).toBe(1040)
  })

  it("persists editable bounds and clamps existing panel widths", () => {
    let saved: Record<string, unknown> = {}
    installMdviewHost({
      readPluginState: () => saved,
      savePluginState: (_pluginId: string, patch: Partial<Record<string, unknown>>) => {
        saved = { ...saved, ...patch }
      },
    } as unknown as MdviewHost)

    setProseWidthFor("md:narrow", 1100)
    setProseWidthBounds({ min: 500, max: 900 })
    expect(proseWidthFor("md:narrow")).toBe(900)
    expect(saved.proseWidthMin).toBe(500)
    expect(saved.proseWidthMax).toBe(900)
  })
})
