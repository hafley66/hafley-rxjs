import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from "react"
import type { Row, RowData } from "@tanstack/react-table"
import type { GridFeatures } from "./0_features"
import type { GridAction, Modifiers } from "./1_types"
import { noMods, treeColumnMeta, type TreeColumn } from "./10_treeColumn"

export const modifiersOf = (e: ReactMouseEvent | MouseEvent): Modifiers => ({
  alt: e.altKey,
  ctrl: e.ctrlKey,
  meta: e.metaKey,
  shift: e.shiftKey,
  button: e.button,
})

// Only a cell of this row (not a nested table's) names the column.
const columnOf = (e: ReactMouseEvent): string | undefined => {
  const td = (e.target as HTMLElement).closest<HTMLElement>("td[data-column]")
  return td && td.parentElement === e.currentTarget ? td.dataset.column : undefined
}

export function TreeTableRow<TData extends RowData>({
  row,
  index,
  rowHeight,
  indentUnit,
  indentGuides,
  background,
  extraClassName,
  dispatch,
}: {
  row: Row<GridFeatures, TData>
  index: number
  rowHeight: number
  indentUnit: number
  indentGuides?: boolean
  background: string
  extraClassName?: string
  dispatch: (action: GridAction<TData>) => void
}) {
  const data = row.original
  const toggle = () => row.toggleExpanded()
  const cellIntent = (type: "cell.click" | "cell.dblclick") => (e: ReactMouseEvent) => {
    const column = columnOf(e)
    if (column) dispatch({ phase: "intent", type, column, rowId: row.id, row: data, mods: modifiersOf(e) })
  }
  return (
    <tr
      data-testid="tree-row"
      data-row-id={row.id}
      data-row-index={index}
      data-expanded={row.getIsExpanded()}
      className={extraClassName}
      style={{ height: rowHeight, background: `var(--grid-row-bg, ${background})` }}
      onClick={cellIntent("cell.click")}
      onDoubleClick={cellIntent("cell.dblclick")}
      onMouseEnter={() => dispatch({ phase: "intent", type: "row.hover", rowId: row.id })}
      onMouseLeave={() => dispatch({ phase: "intent", type: "row.hover", rowId: null })}
    >
      {row.getVisibleCells().map((cell) => {
        const c = treeColumnMeta<TData>(cell.column.columnDef)
        if (!c) return <td key={cell.id} data-column={cell.column.id} />
        const isTree = !!c.tree
        const canExpand = isTree && row.getCanExpand()
        return (
          <td
            key={cell.id}
            className={c.cellClass?.(data)}
            data-column={c.id}
            style={isTree ? { paddingLeft: 8, overflow: "hidden" } : undefined}
            onClick={
              c.toggleExpand && row.getCanExpand()
                ? (e) => {
                    if (noMods(modifiersOf(e))) toggle()
                  }
                : undefined
            }
          >
            {isTree ? (
              <>
                <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  <span
                    aria-hidden
                    data-testid="tree-indent"
                    style={{
                      flex: "0 1 auto",
                      alignSelf: "stretch",
                      width: row.depth * indentUnit,
                      background: indentGuides
                        ? `repeating-linear-gradient(to right, transparent 0 ${indentUnit / 2}px, var(--grid-hairline, rgba(0,0,0,.08)) ${indentUnit / 2}px ${indentUnit / 2 + 1}px, transparent ${indentUnit / 2 + 1}px ${indentUnit}px)`
                        : undefined,
                    }}
                  />
                  {canExpand ? (
                    <button
                      type="button"
                      data-testid={`toggle-${row.id}`}
                      aria-label={row.getIsExpanded() ? "collapse row" : "expand row"}
                      onClick={(e) => {
                        e.stopPropagation()
                        toggle()
                      }}
                      style={{
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        padding: 0,
                        display: "inline-flex",
                        flex: "none",
                        width: 14,
                        color: "var(--grid-muted-fg, #9ca3af)",
                      }}
                    >
                      {row.getIsExpanded() ? "▾" : "▸"}
                    </button>
                  ) : (
                    <span style={{ display: "inline-block", flex: "none", width: 14 }} />
                  )}
                  <span style={{ flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.cell(data)}
                  </span>
                </span>
              </>
            ) : (
              c.cell(data)
            )}
          </td>
        )
      })}
    </tr>
  )
}

export function TreeDetailRow<TData extends RowData>({
  row,
  colSpan,
  renderDetail,
}: {
  row: Row<GridFeatures, TData>
  colSpan: number
  renderDetail: (row: TData) => ReactNode
}) {
  const style: CSSProperties & Record<"--depth", number> = {
    "--depth": row.depth,
    borderInlineStart: "3px solid var(--grid-accent, #3b82f6)",
    paddingInline: 12,
    paddingBlock: 10,
    background: "var(--grid-row-alternate-bg, #fafafa)",
  }
  return (
    <tr data-testid="tree-detail-row" data-depth={row.depth}>
      <td colSpan={colSpan} style={style}>
        {renderDetail(row.original)}
      </td>
    </tr>
  )
}
