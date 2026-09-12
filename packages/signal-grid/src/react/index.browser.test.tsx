import { createElement, StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { act } from "react"
import { describe, expect, it } from "vitest"
import { grid } from "../8_grid.js"
import { GridView, reactSlot } from "./index.js"
import type { ColumnDef } from "../0_types.js"

// `act` refuses to batch without it, and every call warns on the console instead.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

interface Row { readonly id: string; readonly name: string }

const ROWS: readonly Row[] = Array.from({ length: 40 }, (_, i) => ({ id: `r${i}`, name: `row ${i}` }))
const COLUMNS: readonly ColumnDef<Row>[] = [{ id: "name", header: "Name", width: 120 }]

const build = (slots?: Parameters<typeof grid<Row>>[0]["slots"]) =>
  grid<Row>({ id: "react-test", rows: ROWS, columns: COLUMNS, rowId: (it) => it.id, ...(slots ? { slots } : {}) })

const settle = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

const mountHost = (): HTMLElement => {
  const host = document.createElement("div")
  host.style.inlineSize = "400px"
  host.style.blockSize = "300px"
  document.body.append(host)
  return host
}

describe("GridView", () => {
  it("renders rows into the element React owns, and stops on unmount", async () => {
    const host = mountHost()
    const root = createRoot(host)
    const g = build()
    await act(async () => { root.render(createElement(GridView<Row>, { grid: g })) })
    const rows = host.getElementsByClassName("sg-row").length
    expect(rows).toBeGreaterThan(0)
    await act(async () => { root.unmount() })
    expect(host.getElementsByClassName("sg-row").length).toBe(0)
    g.close()
    host.remove()
  })

  it("rebuilds nothing when the parent re-renders with the same grid", async () => {
    const host = mountHost()
    const root = createRoot(host)
    const g = build()
    await act(async () => { root.render(createElement(GridView<Row>, { grid: g })) })
    const first = host.getElementsByClassName("sg-row")[0]
    await act(async () => { root.render(createElement(GridView<Row>, { grid: g, className: "again" })) })
    expect(host.getElementsByClassName("sg-row")[0]).toBe(first)
    await act(async () => { root.unmount() })
    g.close()
    host.remove()
  })

  it("survives StrictMode's double mount", async () => {
    const host = mountHost()
    const root = createRoot(host)
    const g = build()
    await act(async () => {
      root.render(createElement(StrictMode, null, createElement(GridView<Row>, { grid: g })))
    })
    await settle()
    expect(host.getElementsByClassName("sg-row").length).toBeGreaterThan(0)
    expect(host.querySelectorAll('[data-route="g"]').length).toBe(1)
    await act(async () => { root.unmount() })
    g.close()
    host.remove()
  })
})

describe("reactSlot", () => {
  it("mounts JSX in a cell, which the DOM path alone drops", async () => {
    const host = mountHost()
    const root = createRoot(host)
    const plain = build()
    await act(async () => { root.render(createElement(GridView<Row>, { grid: plain })) })
    await settle()
    const withoutBridge = host.getElementsByClassName("sg-react").length
    await act(async () => { root.unmount() })
    plain.close()

    const bridged = build({
      cell: reactSlot((ctx: { readonly row: string }) => createElement("b", { className: "jsx" }, String(ctx.row))),
    })
    const root2 = createRoot(host)
    await act(async () => { root2.render(createElement(GridView<Row>, { grid: bridged })) })
    await settle()
    expect(withoutBridge).toBe(0)
    expect(host.getElementsByClassName("sg-react").length).toBeGreaterThan(0)
    expect(host.getElementsByClassName("jsx").length).toBeGreaterThan(0)
    await act(async () => { root2.unmount() })
    bridged.close()
    host.remove()
  })
})
