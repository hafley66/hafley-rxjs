import { useCallback, useEffect, useMemo, type CSSProperties, type ReactNode } from "react"
import type { RowData } from "@tanstack/react-table"
import { filter } from "rxjs"
import { runEpics, useSignal } from "@hafley66/signals/react"
import { useExternalVirtualizer, type ScrollMode } from "@hafley66/virtualizations"
import { useGrid } from "./3_react"
import type { Grid } from "./1_types"
import { columnEpics, selectOnPlainClick, treeColumnDefs, type TreeColumn } from "./10_treeColumn"
import { anyWidthSignal } from "./9_treeSize"
import { TreeTableRow, TreeDetailRow } from "./11_treeTableRow"
import { TreeTableColGroup, TreeTableHead } from "./14_treeTableHead"

export type TreeTableDensity = "compact" | "standard" | "cozy"

const ROW_HEIGHT: Record<TreeTableDensity, number> = { compact: 26, standard: 34, cozy: 44 }

export type TreeTableProps<TData extends RowData> = {
  grid: Grid<TData>
  columns: TreeColumn<TData>[]
  density?: TreeTableDensity
  rowHeight?: number
  scrollMode?: ScrollMode
  scrollElement?: HTMLElement | null
  maxHeight?: number
  showHeader?: boolean
  showFooter?: boolean
  indentUnit?: number
  indentGuides?: boolean
  renderDetail?: (row: TData) => ReactNode
  rowClassName?: (row: TData) => string | undefined
  // Sugar over grid.actions$ effect "select".
  onRowClick?: (row: TData) => void
}

const C = {
  border: "var(--grid-border, #e5e7eb)",
  hair: "var(--grid-hairline, #f3f4f6)",
  label: "var(--grid-muted-fg, #6b7280)",
  surface: "var(--grid-bg, #fff)",
  alternate: "var(--grid-row-alternate-bg, #fafafa)",
}

const HEADER_STYLE: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: "var(--grid-tree-header-z, 2)" as unknown as number,
}

export function TreeTable<TData extends RowData>({
  grid,
  columns,
  density = "standard",
  rowHeight: rowHeightProp,
  scrollMode = "external",
  scrollElement,
  maxHeight = 600,
  showHeader = true,
  showFooter = true,
  indentUnit = 14,
  indentGuides = false,
  renderDetail,
  rowClassName,
  onRowClick,
}: TreeTableProps<TData>) {
  const colDefs = useMemo(() => treeColumnDefs(columns), [columns])
  const table = useGrid(grid, colDefs)
  useEffect(() => {
    const epics = [selectOnPlainClick(columns), ...columnEpics(columns)]
    const sub = runEpics(grid.actions$, grid.state, grid.epicCtx, epics, grid.dispatch).subscribe()
    return () => sub.unsubscribe()
  }, [grid, columns])
  useEffect(() => {
    if (!onRowClick) return
    const sub = grid.actions$
      .pipe(filter((a) => a.phase === "effect" && a.type === "select"))
      .subscribe((a) => onRowClick((a as Extract<typeof a, { type: "select" }>).row))
    return () => sub.unsubscribe()
  }, [grid, onRowClick])
  const state = useSignal(grid.state.$)
  const rowHeight = rowHeightProp ?? ROW_HEIGHT[density]
  const rows = table.getRowModel().rows
  const rowCount = rows.length
  const estimatedRowsHeight = rowCount * rowHeight
  const external = scrollMode === "external"
  const virtualizer = useExternalVirtualizer({
    count: rowCount,
    estimateSize: rowHeight,
    enabled: external && estimatedRowsHeight > (typeof window === "undefined" ? 0 : window.innerHeight),
    scrollElement,
  })
  const windowItems = virtualizer.virtual
    ? virtualizer.items.map((item) => ({ index: item.index, measure: item }))
    : Array.from({ length: rowCount }, (_, index) => ({ index, measure: null }))
  const measureRow = useCallback((node: HTMLTableSectionElement | null) => {
    if (!node) return
    requestAnimationFrame(() => {
      if (node.isConnected) virtualizer.measureElement(node as unknown as HTMLTableRowElement)
    })
  }, [virtualizer.measureElement])

  const visibleColumns = useMemo(
    () => columns.filter((c) => state.columnVisibility[c.id] !== false),
    [columns, state.columnVisibility],
  )
  const sizeById: Record<string, number | undefined> = {}
  for (const c of columns) sizeById[c.id] = c.size
  const sized = anyWidthSignal(visibleColumns.map((c) => c.id), state.columnSizing, sizeById)
  const headers = table.getHeaderGroups()[0]?.headers ?? []
  const colgroup = <TreeTableColGroup headers={headers} sized={sized} columnSizing={state.columnSizing} sizeById={sizeById} />

  const renderBody = (translateY: number) =>
    windowItems.map(({ index, measure }) => {
      const row = rows[index]!
      return (
        <tbody
          key={row.id}
          ref={measure ? measureRow : undefined}
          data-index={measure?.index}
          style={{ transform: `translateY(${translateY}px)` }}
        >
          <TreeTableRow
            row={row}
            index={index}
            columns={visibleColumns}
            rowHeight={rowHeight}
            indentUnit={indentUnit}
            indentGuides={indentGuides}
            background={index % 2 ? C.alternate : C.surface}
            extraClassName={rowClassName?.(row.original)}
            dispatch={grid.dispatch}
          />
          {renderDetail && row.getIsExpanded() ? (
            <TreeDetailRow row={row} columns={visibleColumns} renderDetail={renderDetail} />
          ) : null}
        </tbody>
      )
    })

  const footer = showFooter ? (
    <div
      data-testid="tree-table-footer"
      style={{ borderTop: `1px solid ${C.hair}`, padding: "6px 12px", fontSize: 11, color: C.label, background: C.surface }}
    >
      {rowCount} {rowCount === 1 ? "row" : "rows"}
    </div>
  ) : null

  if (!virtualizer.virtual) {
    return (
      <div
        data-testid="tree-table"
        data-scroll-mode={scrollMode}
        ref={virtualizer.rootRef}
        style={{
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          background: C.surface,
          ...(scrollMode === "internal" ? { maxHeight, overflowY: "auto" as const } : {}),
        }}
      >
        <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: sized ? "fixed" : "auto" }}>
          {colgroup}
          {showHeader ? <TreeTableHead headers={headers} style={HEADER_STYLE} dispatch={grid.dispatch} /> : null}
          {renderBody(0)}
        </table>
        {footer}
      </div>
    )
  }

  return (
    <div
      data-testid="tree-table"
      data-scroll-mode={scrollMode}
      ref={virtualizer.rootRef}
      style={{ position: "relative", height: virtualizer.totalSize + virtualizer.headerHeight + virtualizer.footerHeight }}
    >
      <div
        data-testid="tree-table-viewport"
        style={{
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          background: C.surface,
          position: "sticky",
          top: 0,
          height: virtualizer.liveViewportHeight,
          maxHeight: "100dvh",
          boxSizing: "border-box",
          overflow: "hidden",
          display: "grid",
          gridTemplateRows: "minmax(0, 1fr) auto",
        }}
      >
        <div style={{ minHeight: 0, overflow: "hidden" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: sized ? "fixed" : "auto" }}>
            {colgroup}
            {showHeader ? (
              <TreeTableHead headers={headers} style={HEADER_STYLE} headerRef={virtualizer.headerRef} dispatch={grid.dispatch} />
            ) : null}
            {renderBody(virtualizer.translateY)}
          </table>
        </div>
        {footer}
      </div>
    </div>
  )
}
