import { flexRender } from "@tanstack/react-table"
import type { RowData } from "@tanstack/react-table"
import { useGrid } from "./3_react"
import type { Grid } from "./1_types"

export type RowDensity = "compact" | "standard" | "cozy"
export type Align = "left" | "right" | "center"

const FONT = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
const C = {
  accent: "#3b82f6",
  border: "#e5e7eb",
  hair: "#f3f4f6",
  head: "#f9fafb",
  label: "#6b7280",
  text: "#111827",
  faint: "#9ca3af",
}

// Never index the rows signal — numeric proxy keys lazy-instantiate.
// Column-id conventions: "__expand" = depth toggle, "name" = depth indent.
export function GridTable<TData extends RowData>({
  grid,
  density = "standard",
  maxHeight = 600,
}: {
  grid: Grid<TData>
  density?: RowDensity
  maxHeight?: number
}) {
  const table = useGrid(grid)
  const h = density === "compact" ? 30 : density === "cozy" ? 52 : 42
  const py = density === "compact" ? 4 : density === "cozy" ? 11 : 7
  const rows = table.getRowModel().rows

  return (
    <div
      data-testid="grid"
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        background: "#fff",
        boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 18px 36px -18px rgba(16,24,40,.18)",
        fontFamily: FONT,
        color: C.text,
        fontSize: 13,
        maxHeight,
        overflowY: "auto",
      }}
    >
      <table style={{ borderCollapse: "collapse", width: "100%", fontVariantNumeric: "tabular-nums" }}>
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((hd) => {
                const sorted = hd.column.getIsSorted()
                const align = (hd.column.columnDef.meta as { align?: Align } | undefined)?.align ?? "left"
                return (
                  <th
                    key={hd.id}
                    onClick={hd.column.getToggleSortingHandler()}
                    style={{
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                      background: C.head,
                      borderBottom: `1px solid ${C.border}`,
                      textAlign: align,
                      padding: `${py + 2}px 16px`,
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: ".045em",
                      textTransform: "uppercase",
                      color: C.label,
                      cursor: hd.column.getCanSort() ? "pointer" : "default",
                      userSelect: "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {hd.isPlaceholder ? null : (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {flexRender(hd.column.columnDef.header, hd.getContext())}
                        {sorted ? (
                          <svg width="9" height="9" viewBox="0 0 9 9" style={{ color: C.accent, transform: sorted === "asc" ? "none" : "rotate(180deg)" }}>
                            <path d="M4.5 1.5 L8 6.5 L1 6.5 Z" fill="currentColor" />
                          </svg>
                        ) : null}
                      </span>
                    )}
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.id}
              style={{ height: h, background: i % 2 ? "#fafafa" : "#fff", borderBottom: `1px solid ${C.hair}` }}
            >
              {row.getVisibleCells().map((cell) => {
                if (cell.column.id === "__expand") {
                  return (
                    <td key={cell.id} style={{ width: 44, padding: "0 12px", textAlign: "center" }}>
                      {row.getCanExpand() ? (
                        <button
                          data-testid="row-toggle"
                          onClick={row.getToggleExpandedHandler()}
                          style={{
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            display: "inline-flex",
                            padding: 2,
                            color: C.faint,
                            transform: row.getIsExpanded() ? "rotate(90deg)" : "none",
                            transition: "transform 120ms ease",
                          }}
                        >
                          <svg width="9" height="9" viewBox="0 0 9 9"><path d="M2.5 1 L7 4.5 L2.5 8 Z" fill="currentColor" /></svg>
                        </button>
                      ) : null}
                    </td>
                  )
                }
                const align = (cell.column.columnDef.meta as { align?: Align } | undefined)?.align ?? "left"
                const indent = cell.column.id === "name" ? row.depth * 18 : 0
                return (
                  <td
                    key={cell.id}
                    style={{
                      padding: `${py}px 16px`,
                      paddingLeft: indent ? indent : 16,
                      textAlign: align,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {cell.column.columnDef.cell
                      ? flexRender(cell.column.columnDef.cell, cell.getContext())
                      : String(cell.getValue() ?? "")}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div
        style={{
          borderTop: `1px solid ${C.hair}`,
          padding: "8px 16px",
          fontSize: 11,
          color: C.faint,
          display: "flex",
          justifyContent: "space-between",
          letterSpacing: ".02em",
        }}
      >
        <span>{rows.length} {rows.length === 1 ? "row" : "rows"}</span>
        <span>{density}</span>
      </div>
    </div>
  )
}
