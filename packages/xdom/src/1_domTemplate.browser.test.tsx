import { act, type CSSProperties } from "react"
import { createRoot } from "react-dom/client"
import { describe, expect, it, vi } from "vitest"
import { page } from "vitest/browser"
import { Dom } from "./react/1_domBox.js"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// Turnkey Box stamps data-route (skeleton) + data-<kebab> params on one
// display:contents element; composition across nested nodes is the deferred builder.
const expand = Dom("/grid/:gridId/row/:rowId/expand")

const gridStyle: CSSProperties = {
  fontFamily: "system-ui, -apple-system, sans-serif",
  background: "#0f172a",
  color: "#e2e8f0",
  padding: 16,
  borderRadius: 10,
  width: 360,
  display: "flex",
  flexDirection: "column",
  gap: 4,
}
const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "8px 10px",
  borderRadius: 6,
  background: "#1e293b",
}
const nameStyle: CSSProperties = { fontSize: 13, fontWeight: 500 }
const btnStyle: CSSProperties = {
  border: "1px solid #334155",
  background: "#334155",
  color: "#93c5fd",
  borderRadius: 5,
  padding: "2px 10px",
  fontSize: 13,
  cursor: "pointer",
}

const rows = [
  { rowId: "42", name: "0_features.ts" },
  { rowId: "7", name: "2_createGrid.ts" },
  { rowId: "99", name: "4_grid.tsx" },
]

describe("Dom.Box relative routing", () => {
  it("stamps skeleton + params and resolves a delegated click per row", async () => {
    const received = vi.fn()
    const sub = expand.route.click.subscribe((event) =>
      received(event.params.rowId, event.delegateElement.dataset.route),
    )

    const host = document.createElement("div")
    document.body.append(host)
    const root = createRoot(host)
    await act(async () =>
      root.render(
        <div data-testid="grid" style={gridStyle}>
          {rows.map((r) => (
            <expand.Box key={r.rowId} gridId="main" rowId={r.rowId} style={rowStyle}>
              <span style={nameStyle}>{r.name}</span>
              <button data-testid={`expand-${r.rowId}`} style={btnStyle}>+</button>
            </expand.Box>
          ))}
        </div>,
      ),
    )

    await expect(page.getByTestId("grid")).toMatchScreenshot("dom-box-rows")

    await act(async () => { await page.getByTestId("expand-7").click() })
    await act(async () => { await page.getByTestId("expand-99").click() })
    expect(received.mock.calls).toEqual([
      ["7", "grid/row/expand"],
      ["99", "grid/row/expand"],
    ])

    sub.unsubscribe()
    root.unmount()
    host.remove()
  })
})
