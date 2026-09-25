import { createElement } from "react";
import { cellId, grid } from "@hafley66/signal-grid";
import { expect, it } from "vitest";
import { markdownTableModel, type MarkdownTableRow } from "./1_tableModel.js";
import { markdownTableCopyText, markdownTableName } from "./2_tableCopy.js";

const row = (tag: "th" | "td", ...cells: string[]) =>
  createElement("tr", null, cells.map((cell, index) => createElement(tag, { key: index }, cell)));

it("names the table and copies the selection in view order, one object or an array", () => {
  const model = markdownTableModel([
    createElement("thead", null, row("th", "Name", "Value", "Note")),
    createElement("tbody", null, row("td", "beta", "2", "b"), row("td", "alpha", "1", "a")),
  ]);
  const tableGrid = grid<MarkdownTableRow>({
    id: "copy-helper",
    rows: model.rows,
    columns: model.headers.map((_, index) => ({ id: `column-${index}`, value: (entry: MarkdownTableRow) => entry.values[index] ?? "", sortable: true })),
    rowId: (entry) => entry.id,
  });
  const table = markdownTableName("/repo/guide.md", "overview", 1);
  const empty = markdownTableCopyText(tableGrid, model, table);
  tableGrid.state.selection.$({ anchor: cellId("row-0", "column-1"), head: cellId("row-0", "column-1"), mode: "cell", blocks: [] });
  const one = markdownTableCopyText(tableGrid, model, table);
  // Sorted by name and Note hidden: beta (row-0) now sits below alpha (row-1), and the copy follows the view.
  tableGrid.state.sort.$([{ field: "column-0", sort: "asc" }]);
  tableGrid.state.colHidden.$({ "column-2": true });
  tableGrid.state.selection.$({ anchor: cellId("row-0", "column-1"), head: cellId("row-1", "column-0"), mode: "cell", blocks: [] });
  const range = markdownTableCopyText(tableGrid, model, table);
  tableGrid.close();
  expect({ fallback: markdownTableName(undefined, undefined, undefined), empty, one, range }).toMatchInlineSnapshot(`
    {
      "empty": undefined,
      "fallback": "#document:0",
      "one": "{"table":"/repo/guide.md#overview:1","row_id":"row-0","col":"Value","value":"2"}",
      "range": "[{"table":"/repo/guide.md#overview:1","row_id":"row-1","col":"Name","value":"alpha"},{"table":"/repo/guide.md#overview:1","row_id":"row-1","col":"Value","value":"1"},{"table":"/repo/guide.md#overview:1","row_id":"row-0","col":"Name","value":"beta"},{"table":"/repo/guide.md#overview:1","row_id":"row-0","col":"Value","value":"2"}]",
    }
  `);
});
