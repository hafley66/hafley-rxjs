import { useSignal } from "@hafley66/signals/react"
import type { RowData } from "@tanstack/react-table"
import type { Grid } from "./1_types"
import { visibilityEntries, toggleColumnVisibility, type TreeColumn } from "./10_treeColumn"

export function ColumnVisibilityToolbar<TData extends RowData>({
  grid,
  columns,
}: {
  grid: Grid<TData>
  columns: TreeColumn<TData>[]
}) {
  const state = useSignal(grid.state.$)
  const entries = visibilityEntries(columns, state.columnVisibility)

  return (
    <div
      data-testid="tree-visibility-toolbar"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        padding: "6px 10px",
        border: "1px solid var(--grid-border, #e5e7eb)",
        borderRadius: 8,
        background: "var(--grid-header-bg, #f9fafb)",
        fontSize: 12,
        color: "var(--grid-fg, #111827)",
      }}
    >
      {entries.map((entry) => (
        <label
          key={entry.id}
          data-testid={`tree-visibility-item-${entry.id}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            opacity: entry.canHide ? 1 : 0.5,
            cursor: entry.canHide ? "pointer" : "not-allowed",
          }}
        >
          <input
            type="checkbox"
            checked={entry.visible}
            disabled={!entry.canHide}
            onChange={() =>
              grid.onColumnVisibilityChange(
                toggleColumnVisibility(state.columnVisibility, entry.id),
              )
            }
          />
          {entry.header}
        </label>
      ))}
    </div>
  )
}
