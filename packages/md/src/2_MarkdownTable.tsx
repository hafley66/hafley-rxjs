import { useEffect, useId, useLayoutEffect, useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import { useSignal } from "@hafley66/signals/react";
import { grid, type ColumnDef, type Grid, type GridState } from "@hafley66/signal-grid";
import type { Signal } from "@hafley66/signals";
import { GridView, reactSlot } from "@hafley66/signal-grid/react";
import "@hafley66/signal-grid/theme.css";
import { longestCodeTokens, markdownTableModel, type MarkdownTableModel, type MarkdownTableRow } from "./lib/1_tableModel.js";
import { markdownTableCopyText } from "./lib/2_tableCopy.js";

const columnId = (index: number): string => `column-${index}`;

export interface MarkdownTableProps {
  readonly children?: ReactNode;
  /** Precomputed by a persistence wrapper when the table model is already needed for identity. */
  readonly model?: MarkdownTableModel;
  /** Caller-owned state signal for Git-root/file/table persistence. */
  readonly tableState?: Signal<Partial<GridState>>;
  /** `<docPath>#<section slug>:<table ordinal>`, carried by every copied cell. */
  readonly tableName?: string;
}

function MarkdownTableHeader({
  header,
  label,
  alignment,
}: {
  readonly header: ReactNode;
  readonly label: string;
  readonly alignment: "left" | "center" | "right";
}): ReactNode {
  return (
    <span className="mdview-table-header-cell" style={{ textAlign: alignment } as CSSProperties}>
      <span className="mdview-table-header-label" title={label}>{header}</span>
    </span>
  );
}

const columnsOf = (model: MarkdownTableModel, codeMins: readonly number[] = []): readonly ColumnDef<MarkdownTableRow>[] =>
  model.headers.map((header, index) => {
    const longest = model.rows.reduce((length, row) => Math.max(length, row.values[index]?.length ?? 0), model.headerValues[index]?.length ?? 0);
    const compact = longest <= 24;
    return ({
    id: columnId(index),
    header: model.headerValues[index] ?? `Column ${index + 1}`,
    value: (row) => row.values[index] ?? "",
    width: compact ? Math.max(96, longest * 8 + 12) : 280,
    minWidth: Math.max(96, codeMins[index] ?? 0),
    flex: compact ? undefined : Math.min(3, Math.max(1, Math.ceil(longest / 80))),
    sortable: true,
    resizable: true,
    movable: false,
    headerCell: reactSlot(() => (
      <MarkdownTableHeader
        header={header}
        label={model.headerValues[index] ?? `Column ${index + 1}`}
        alignment={model.alignments[index] ?? "left"}
      />
    ), { sync: false }),
    cell: reactSlot(({ data }: { readonly data: MarkdownTableRow; readonly col: string }) => {
      const cell = data.cells[Number(index)];
      const alignment = model.alignments[index];
      return (
        <span
          className="mdview-table-cell"
          style={{ textAlign: alignment, justifyContent: alignment === "right" ? "flex-end" : alignment === "center" ? "center" : undefined }}
        >
          {cell}
        </span>
      );
    }, { sync: false }),
    });
  });

const sameModel = (a: MarkdownTableModel, b: MarkdownTableModel): boolean => {
  if (a.headers.length !== b.headers.length || a.rows.length !== b.rows.length) return false;
  if (a.headers.some((header, index) => !Object.is(header, b.headers[index]))) return false;
  if (a.alignments.some((alignment, index) => alignment !== b.alignments[index])) return false;
  return a.rows.every((row, index) => {
    const other = b.rows[index];
    return other !== undefined && row.cells.length === other.cells.length &&
      row.cells.every((cell, cellIndex) => Object.is(cell, other.cells[cellIndex]));
  });
};

interface TableGridState {
  readonly grid: Grid<MarkdownTableRow>;
  readonly tableState: Signal<Partial<GridState>> | undefined;
  model: MarkdownTableModel;
  active: boolean;
}

function createTableGrid(
  model: MarkdownTableModel,
  id: string,
  tableState: Signal<Partial<GridState>> | undefined,
): Grid<MarkdownTableRow> {
  const tableGrid = grid<MarkdownTableRow>({
    id,
    rows: model.rows,
    columns: columnsOf(model),
    rowId: (row) => row.id,
    rowMeasure: { initial: 28, bufferPx: 360 },
    state: tableState,
  });
  tableGrid.state.density.$("compact");
  return tableGrid;
}

function useTableGrid(
  model: MarkdownTableModel,
  id: string,
  tableState: Signal<Partial<GridState>> | undefined,
): Grid<MarkdownTableRow> {
  const held = useRef<TableGridState | null>(null);
  if (held.current === null) {
    held.current = { grid: createTableGrid(model, id, tableState), tableState, model, active: false };
  } else if (held.current.tableState !== tableState) {
    const previous = held.current;
    previous.active = false;
    held.current = { grid: createTableGrid(model, id, tableState), tableState, model, active: false };
    queueMicrotask(() => previous.grid.close());
  }
  const current = held.current;

  useLayoutEffect(() => {
    if (sameModel(current.model, model)) return;
    current.model = model;
    current.grid.rows.$(model.rows);
    current.grid.columns.$(columnsOf(model));
  }, [current, model]);

  useEffect(() => {
    current.active = true;
    return () => {
      current.active = false;
      queueMicrotask(() => {
        if (!current.active) current.grid.close();
      });
    };
  }, [current]);
  return current.grid;
}

/** Each column's longest code token laid out in a hidden cell of this grid, so the minimum
 * carries the skin's font, the code padding, and the cell's own padding and rule. */
function measureCodeMins(model: MarkdownTableModel, gridRoot: HTMLElement): readonly number[] {
  return longestCodeTokens(model).map((token) => {
    if (token === undefined) return 0;
    const cell = document.createElement("div");
    cell.className = "sg-cell";
    cell.style.cssText = "position: absolute; visibility: hidden; inline-size: max-content; white-space: nowrap";
    const code = cell.appendChild(document.createElement("code"));
    if (token.className !== undefined) code.className = token.className;
    code.dataset.streamdown = "inline-code";
    code.textContent = token.text;
    gridRoot.append(cell);
    const width = Math.ceil(cell.offsetWidth);
    cell.remove();
    return width;
  });
}

export default function MarkdownTable({ children, model: suppliedModel, tableState, tableName }: MarkdownTableProps): ReactNode {
  const model = useMemo(() => suppliedModel ?? markdownTableModel(children), [children, suppliedModel]);
  const tableId = useId().replaceAll(":", "");
  const tableGrid = useTableGrid(model, `markdown-table-${tableId}`, tableState);
  const sectionRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const gridRoot = sectionRef.current?.querySelector<HTMLElement>(".mdview-table-grid");
    if (gridRoot === null || gridRoot === undefined) return;
    let live = true;
    const apply = (): void => {
      const mins = measureCodeMins(model, gridRoot);
      if (live && mins.some((width) => width > 0)) tableGrid.columns.$(columnsOf(model, mins));
    };
    apply();
    void document.fonts.ready.then(apply);
    return () => { live = false; };
  }, [tableGrid, model]);
  return (
    <section
      ref={sectionRef}
      className="mdview-table"
      aria-label="Markdown table"
      onCopy={(event) => {
        const text = markdownTableCopyText(tableGrid, model, tableName ?? null);
        if (text === undefined) return;
        event.preventDefault();
        event.clipboardData.setData("text/plain", text);
      }}
    >
      <GridView grid={tableGrid} className="mdview-table-grid" />
    </section>
  );
}

export { columnsOf, markdownTableModel, sameModel };
