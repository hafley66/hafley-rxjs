import { act } from "react"
import { createRoot } from "react-dom/client"
import { describe, expect, it } from "vitest"
import { page } from "vitest/browser"
import { GitMergeDemo, ObservableKindsDemo } from "./2a_DemoViz"
import "./2_marbler.css"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe("timeline tree demos", () => {
  it("renders git merge lanes with nested commit entries", async () => {
    const host = document.createElement("div")
    document.body.append(host)
    const root = createRoot(host)
    await act(async () => root.render(<GitMergeDemo />))
    await expect.poll(() => host.querySelectorAll("canvas").length).toBe(1)
    expect({ lanes: host.querySelectorAll("details").length, entries: host.querySelectorAll(".demo-entry").length }).toMatchInlineSnapshot(`
      {
        "entries": 8,
        "lanes": 3,
      }
    `)
    await expect(page.getByText("feature/grid", { exact: true }).first()).toBeVisible()
    await expect(page.getByText("73aa expansion", { exact: true })).toBeVisible()
    await expect(page.getByTestId("timeline-tree-demo")).toMatchScreenshot("4_git-merge-tree")
    await act(async () => root.unmount())
    host.remove()
  })

  it("renders observable kinds with nested notifications", async () => {
    const host = document.createElement("div")
    document.body.append(host)
    const root = createRoot(host)
    await act(async () => root.render(<ObservableKindsDemo />))
    await expect.poll(() => host.querySelectorAll("canvas").length).toBe(1)
    expect({ lanes: host.querySelectorAll("details").length, entries: host.querySelectorAll(".demo-entry").length }).toMatchInlineSnapshot(`
      {
        "entries": 24,
        "lanes": 6,
      }
    `)
    await expect(page.getByText("switchMap(query → request)", { exact: true }).first()).toBeVisible()
    await expect(page.getByText("retry({ count: 2 })", { exact: true }).first()).toBeVisible()
    await expect(page.getByTestId("timeline-tree-demo")).toMatchScreenshot("5_observable-kinds-tree")
    await act(async () => root.unmount())
    host.remove()
  })
})
