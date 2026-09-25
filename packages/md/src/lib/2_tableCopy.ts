import { cellId, rangeOf, selectionTest, type Grid } from "@hafley66/signal-grid";
import type { MarkdownTableModel, MarkdownTableRow } from "./1_tableModel.js";

/** One copied cell. Field names are the clipboard contract. */
export interface MarkdownTableCopiedCell {
  readonly table: string | null;
  readonly row_id: string;
  readonly col: string;
  readonly value: string;
}

/** `<docPath>#<section slug>:<table ordinal>`, the name a copied cell carries. */
export const markdownTableName = (filePath: string | undefined, sectionId: string | undefined, ordinal: number | undefined): string =>
  `${filePath ?? ""}#${sectionId ?? "document"}:${ordinal ?? 0}`;

/**
 * The selected cells in view order, row-major: rows as the grid shows them (sorted), columns as
 * it lays them out (reordered, hidden ones skipped). Undefined when nothing is selected, so the
 * caller leaves the native copy alone. One cell is one JSON object, a range is an array of them.
 */
export function markdownTableCopyText(
  tableGrid: Grid<MarkdownTableRow>,
  model: MarkdownTableModel,
  table: string | null,
): string | undefined {
  const vertical = tableGrid.view.vertical.$().nodes.map((node) => node.key);
  const horizontal = tableGrid.view.colLeaves.$();
  const covers = selectionTest(rangeOf(tableGrid.state.selection.$()), vertical, horizontal);
  const rows = new Map(model.rows.map((row) => [row.id, row] as const));
  const cells: MarkdownTableCopiedCell[] = vertical.flatMap((rowId) => horizontal
    .filter((col) => covers(cellId(rowId, col)))
    .map((col) => {
      const index = Number(col.slice("column-".length));
      return {
        table,
        row_id: rowId,
        col: model.headerValues[index] ?? col,
        value: rows.get(rowId)?.values[index] ?? "",
      };
    }));
  if (cells.length === 0) return undefined;
  return JSON.stringify(cells.length === 1 ? cells[0] : cells);
}
