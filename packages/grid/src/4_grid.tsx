import { useCallback } from "react"
import { flexRender } from "@tanstack/react-table"
import type { RowData } from "@tanstack/react-table"
import { useGrid } from "./3_react"
import type { Grid } from "./1_types"
import { type GridScrollMode, useExternalGridVirtualizer } from "./4b_externalVirtualizer"

export type { GridScrollMode } from "./4b_externalVirtualizer"

export type RowDensity = "compact" | "standard" | "cozy"
export type Align = "left" | "right" | "center"

const FONT = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
const C = {
  accent: "var(--grid-accent, #3b82f6)",
  border: "var(--grid-border, #e5e7eb)",
  hair: "var(--grid-hairline, #f3f4f6)",
  head: "var(--grid-header-bg, #f9fafb)",
  label: "var(--grid-muted-fg, #6b7280)",
  text: "var(--grid-fg, #111827)",
  faint: "var(--grid-faint-fg, #9ca3af)",
  surface: "var(--grid-bg, #fff)",
  alternate: "var(--grid-row-alternate-bg, #fafafa)",
}

// Never index the rows signal — numeric proxy keys lazy-instantiate.
// Column-id conventions: "__expand" = depth toggle, "name" = depth indent.
export function GridTable<TData extends RowData>({
  grid,
  density = "standard",
  maxHeight = 600,
  scrollMode = "external",
  scrollElement,
}: {
  grid: Grid<TData>
  density?: RowDensity
  maxHeight?: number
  /** External mode retains body/ancestor scroll ownership and is the default. */
  scrollMode?: GridScrollMode
  /** Overrides automatic discovery of the nearest overflow-y scroll ancestor. */
  scrollElement?: HTMLElement | null
}) {
  const table = useGrid(grid)
  const h = density === "compact" ? 30 : density === "cozy" ? 52 : 42
  const py = density === "compact" ? 4 : density === "cozy" ? 11 : 7
  const rows = table.getRowModel().rows
  const estimatedRowsHeight = rows.length * h
  const external = scrollMode === "external"
  const virtualizer = useExternalGridVirtualizer({
    count: rows.length,
    estimateSize: h,
    enabled: external && estimatedRowsHeight > (typeof window === "undefined" ? 0 : window.innerHeight),
    scrollElement,
  })
  const virtualRows = virtualizer.virtual ? virtualizer.virtualizer.getVirtualItems() : []
  const liveVirtualRows = virtualizer.virtual
    ? virtualRows.filter((item) => item.index >= virtualizer.visibleStart && item.index <= virtualizer.visibleEnd)
    : []
  const measureRow = useCallback((node: HTMLTableRowElement | null) => {
    if (!node) return
    requestAnimationFrame(() => {
      if (node.isConnected) virtualizer.virtualizer.measureElement(node)
    })
  }, [virtualizer.virtualizer])
  const renderedRows = virtualizer.virtual
    ? liveVirtualRows.map((item) => ({ row: rows[item.index]!, index: item.index, measure: item }))
    : rows.map((row, index) => ({ row, index, measure: null }))
  const liveRowsHeight = liveVirtualRows.reduce((height, item) => height + item.size, 0)
  const virtualRowsHeight = virtualizer.virtual ? virtualizer.totalSize : estimatedRowsHeight
  const layoutHeight = virtualRowsHeight + virtualizer.headerHeight + virtualizer.footerHeight
  const liveViewportHeight = Math.min(
    virtualizer.viewportHeight,
    virtualizer.headerHeight + liveRowsHeight + virtualizer.footerHeight,
  )

  const renderRow = (row: typeof rows[number], index: number, measure: typeof virtualRows[number] | null) => (
    <tr
      key={row.id}
      data-testid="grid-row"
      data-row-index={index}
      data-index={measure?.index}
      ref={measure ? measureRow : undefined}
      style={{ height: h, background: index % 2 ? C.alternate : C.surface, borderBottom: `1px solid ${C.hair}` }}
    >
      {row.getVisibleCells().map((cell) => {
        if (cell.column.id === "__expand") {
          return (
            <td key={cell.id} style={{ width: 44, padding: "0 8px", textAlign: "left", overflow: "visible" }}>
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
                    marginLeft: row.depth * 12,
                    color: C.faint,
                  }}
                >
                  <svg
                    width="9"
                    height="9"
                    viewBox="0 0 9 9"
                    style={{
                      display: "block",
                      transform: row.getIsExpanded() ? "rotate(90deg)" : "none",
                      transformOrigin: "50% 50%",
                      transition: "transform 120ms ease",
                    }}
                  ><path d="M2.5 1 L7 4.5 L2.5 8 Z" fill="currentColor" /></svg>
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
              paddingLeft: 16 + indent,
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
  )

  // Short grids retain the original table/card structure. The external spacer
  // and sticky live viewport begin once estimated rows exceed 100dvh.
  if (!virtualizer.virtual) {
    return (
      <div
        data-testid="grid"
        data-scroll-mode={scrollMode}
        data-visible-start={0}
        data-visible-end={Math.max(-1, rows.length - 1)}
        data-virtual-total-size={estimatedRowsHeight}
        data-virtual-estimate-size={estimatedRowsHeight}
        data-scroll-owner={virtualizer.scrollOwner}
        data-scroll-margin={virtualizer.scrollMargin}
        ref={virtualizer.rootRef}
        style={{
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          background: C.surface,
          boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 18px 36px -18px rgba(16,24,40,.18)",
          fontFamily: FONT,
          color: C.text,
          fontSize: 13,
          ...(scrollMode === "internal" ? { maxHeight, overflowY: "auto" as const } : {}),
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
                style={{ height: h, background: i % 2 ? C.alternate : C.surface, borderBottom: `1px solid ${C.hair}` }}
              >
                {row.getVisibleCells().map((cell) => {
                  if (cell.column.id === "__expand") {
                    return (
                      <td key={cell.id} style={{ width: 44, padding: "0 8px", textAlign: "left", overflow: "visible" }}>
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
                              marginLeft: row.depth * 12,
                              color: C.faint,
                            }}
                          >
                            <svg
                              width="9"
                              height="9"
                              viewBox="0 0 9 9"
                              style={{
                                display: "block",
                                transform: row.getIsExpanded() ? "rotate(90deg)" : "none",
                                transformOrigin: "50% 50%",
                                transition: "transform 120ms ease",
                              }}
                            ><path d="M2.5 1 L7 4.5 L2.5 8 Z" fill="currentColor" /></svg>
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
                        paddingLeft: 16 + indent,
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
          data-testid="grid-footer"
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

  return (
    <div
      data-testid="grid"
      data-scroll-mode={scrollMode}
      data-visible-start={virtualizer.virtual ? virtualizer.visibleStart : 0}
      data-visible-end={virtualizer.virtual ? virtualizer.visibleEnd : Math.max(-1, rows.length - 1)}
      data-virtual-total-size={virtualRowsHeight}
      data-virtual-estimate-size={virtualizer.estimatedSize}
      data-scroll-owner={virtualizer.scrollOwner}
      data-scroll-margin={virtualizer.scrollMargin}
      ref={virtualizer.rootRef}
      style={{
        fontFamily: FONT,
        color: C.text,
        fontSize: 13,
        // The outer extent is the only contribution to the owning scroll
        // flow. This branch executes only for external virtual grids.
        height: layoutHeight,
        position: "relative" as const,
      }}
    >
      <div
        data-testid="grid-viewport"
        style={{
          ...(virtualizer.virtual
            ? {
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                background: C.surface,
                boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 18px 36px -18px rgba(16,24,40,.18)",
                // `dvh` responds to viewport resize. The outer grid keeps the
                // estimated row height in the owning scroll flow; this box is
                // only the live row window and never creates a scrollbar.
                position: "sticky" as const,
                top: 0,
                // A terminal range can contain fewer rows than the viewport.
                // Keep that window intrinsic so the flow footer follows Row
                // 099 immediately, while middle ranges still cap at 100dvh.
                height: liveViewportHeight,
                maxHeight: "100dvh",
                boxSizing: "border-box",
                overflow: "clip",
                display: "grid",
                gridTemplateRows: "minmax(0, 1fr) auto",
              }
            : { display: "contents" }),
        }}
      >
      <div style={virtualizer.virtual ? { minHeight: 0, overflow: "clip" } : { display: "contents" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontVariantNumeric: "tabular-nums" }}>
        <thead ref={virtualizer.headerRef}>
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
          {/* The outer grid supplies the measured full extent to the scroll
              owner. Spacer rows would place this live window below its own
              clipped viewport, so the table contains only mounted rows. */}
          {renderedRows.map(({ row, index, measure }) => renderRow(row, index, measure))}
        </tbody>
      </table>
      </div>
      <div
        data-testid="grid-footer"
        style={{
          borderTop: `1px solid ${C.hair}`,
          padding: "8px 16px",
          fontSize: 11,
          color: C.faint,
          display: "flex",
          justifyContent: "space-between",
          letterSpacing: ".02em",
          ...(virtualizer.virtual ? { background: C.surface } : {}),
        }}
      >
        <span>{rows.length} {rows.length === 1 ? "row" : "rows"}</span>
        <span>{density}</span>
      </div>
      </div>
    </div>
  )
}
