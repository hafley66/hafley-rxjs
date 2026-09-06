// Width-signal helpers ported from instant/src/treetableSize.ts.
// A column gets an explicit width only when dragged (columnSizing) or authored (`size`).
import type { ColumnSizingState } from "@tanstack/react-table"

export function hasWidthSignal(
  columnId: string,
  columnSizing: ColumnSizingState,
  explicitSize: number | undefined,
): boolean {
  return columnSizing[columnId] !== undefined || explicitSize !== undefined
}

// True when any column carries a width signal; the caller then switches to fixed table-layout.
export function anyWidthSignal(
  columnIds: readonly string[],
  columnSizing: ColumnSizingState,
  explicitSizes: Record<string, number | undefined>,
): boolean {
  return columnIds.some((id) => hasWidthSignal(id, columnSizing, explicitSizes[id]))
}
