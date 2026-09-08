import type { CSSProperties, Ref } from "react"
import { flexRender, type ColumnSizingState, type Header, type RowData } from "@tanstack/react-table"
import type { GridFeatures } from "./0_features"
import type { GridAction } from "./1_types"
import { modifiersOf } from "./11_treeTableRow"
import { noMods } from "./10a_columnEpics"
import { hasWidthSignal } from "./9_treeSize"

const C = {
  border: "var(--grid-border, #e5e7eb)",
  head: "var(--grid-header-bg, #f9fafb)",
  label: "var(--grid-muted-fg, #6b7280)",
  accent: "var(--grid-accent, #2563eb)",
}

export function TreeTableColGroup<TData extends RowData>({
  headers,
  sized,
  columnSizing,
  sizeById,
}: {
  headers: readonly Header<GridFeatures, TData, unknown>[]
  sized: boolean
  columnSizing: ColumnSizingState
  sizeById: Record<string, number | undefined>
}) {
  if (!sized) return null
  return (
    <colgroup>
      {headers.map((h) => {
        const w = hasWidthSignal(h.column.id, columnSizing, sizeById[h.column.id]) ? h.column.getSize() : undefined
        return <col key={h.id} style={w !== undefined ? { width: w } : undefined} />
      })}
    </colgroup>
  )
}

// Drag gutter on the header's trailing edge: TanStack's resize handler owns the document listeners
// and commits into columnSizing (onChange mode); the click after mouseup is swallowed so it never sorts.
function ResizeHandle<TData extends RowData>({ header }: { header: Header<GridFeatures, TData, unknown> }) {
  const active = header.column.getIsResizing()
  const start = header.getResizeHandler()
  return (
    <button
      type="button"
      data-testid={`resize-${header.column.id}`}
      aria-label={`resize ${header.column.id}`}
      onMouseDown={start}
      onTouchStart={start}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        border: "none",
        padding: 0,
        top: 0,
        right: -3,
        width: 7,
        height: "100%",
        cursor: "col-resize",
        userSelect: "none",
        touchAction: "none",
        background: active ? C.accent : "transparent",
        opacity: active ? 0.6 : 1,
        zIndex: 1,
      }}
    />
  )
}

export function TreeTableHead<TData extends RowData>({
  headers,
  style,
  headerRef,
  dispatch,
}: {
  headers: readonly Header<GridFeatures, TData, unknown>[]
  style: CSSProperties
  headerRef?: Ref<HTMLTableSectionElement>
  dispatch: (action: GridAction<TData>) => void
}) {
  return (
    <thead ref={headerRef} data-testid="tree-table-header" style={style}>
      <tr>
        {headers.map((h) => {
          const sortable = h.column.getCanSort()
          const dir = h.column.getIsSorted()
          return (
            <th
              key={h.id}
              data-column={h.column.id}
              onClick={(e) => {
                const mods = modifiersOf(e)
                dispatch({ phase: "intent", type: "header.click", column: h.column.id, mods })
                if (sortable && noMods(mods)) h.column.getToggleSortingHandler()?.(e)
              }}
              style={{
                position: "relative",
                background: C.head,
                borderBottom: `1px solid ${C.border}`,
                textAlign: "left",
                padding: "8px 12px",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: ".045em",
                textTransform: "uppercase",
                color: C.label,
                cursor: sortable ? "pointer" : "default",
                userSelect: "none",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {flexRender(h.column.columnDef.header, h.getContext())}
              {dir ? <span> {dir === "asc" ? "▲" : "▼"}</span> : null}
              {h.column.getCanResize() ? <ResizeHandle header={h} /> : null}
            </th>
          )
        })}
      </tr>
    </thead>
  )
}
