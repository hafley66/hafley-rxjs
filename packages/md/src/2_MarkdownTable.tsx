import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useSignal } from "@hafley66/signals/react";
import { grid, type ColumnDef, type Grid, type GridState } from "@hafley66/signal-grid";
import type { Signal } from "@hafley66/signals";
import { GridView, reactSlot } from "@hafley66/signal-grid/react";
import "@hafley66/signal-grid/theme.css";
import { markdownTableModel, type MarkdownTableModel, type MarkdownTableRow } from "./lib/1_tableModel.js";

const columnId = (index: number): string => `column-${index}`;

export interface MarkdownTableProps {
  readonly children?: ReactNode;
  /** Precomputed by a persistence wrapper when the table model is already needed for identity. */
  readonly model?: MarkdownTableModel;
  /** Caller-owned state signal for Git-root/file/table persistence. */
  readonly tableState?: Signal<Partial<GridState>>;
}

const plainModifiers = { alt: false, ctrl: false, meta: false, shift: false, button: 0 } as const;

const stopHeaderGesture = (event: { readonly stopPropagation: () => void }): void => {
  event.stopPropagation();
};

function toggleColumn(tableGrid: Grid<MarkdownTableRow>, id: string, hidden: boolean): void {
  const current = tableGrid.state.colHidden.$();
  const visible = tableGrid.columns.$().filter((column) => current[column.id] !== true).length;
  if (!hidden && visible <= 1) return;
  tableGrid.state.colHidden.$({ ...current, [id]: !hidden });
}

function ColumnVisibilityMenu({ tableGrid }: { readonly tableGrid: Grid<MarkdownTableRow> }): ReactNode {
  const state = useSignal(tableGrid.state.$);
  const columns = tableGrid.columns.$();
  const visible = columns.filter((column) => state.colHidden[column.id] !== true);
  const hidden = columns.filter((column) => state.colHidden[column.id] === true);
  const item = (column: ColumnDef<MarkdownTableRow>): ReactNode => {
    const isHidden = state.colHidden[column.id] === true;
    return (
      <label key={column.id} className="mdview-table-column-menu-item" data-md-table-column={column.id} onPointerDown={stopHeaderGesture}>
        <input
          type="checkbox"
          aria-label={`${column.header ?? column.id} ${isHidden ? "hidden" : "visible"}`}
          checked={!isHidden}
          disabled={!isHidden && visible.length <= 1}
          onClick={stopHeaderGesture}
          onChange={() => toggleColumn(tableGrid, column.id, isHidden)}
        />
        <span aria-hidden="true" data-md-table-column-label={column.header ?? column.id} />
        <span aria-hidden="true" className="mdview-table-column-menu-state" data-md-table-column-state={isHidden ? "hidden" : "visible"} />
      </label>
    );
  };
  return (
    <div className="mdview-table-visibility">
      <button
        type="button"
        className="mdview-table-action mdview-table-action-visibility"
        aria-label="Show or hide columns"
        aria-haspopup="menu"
        onClick={stopHeaderGesture}
        onPointerDown={stopHeaderGesture}
      >
        <span aria-hidden="true" />
      </button>
      <div className="mdview-table-column-menu" role="menu">
        <div className="mdview-table-column-menu-section" aria-label="Visible columns" data-md-table-section="Visible columns" />
        {visible.map(item)}
        {hidden.length === 0 ? null : <div className="mdview-table-column-menu-section" aria-label="Hidden columns" data-md-table-section="Hidden columns" />}
        {hidden.map(item)}
      </div>
      {hidden.length === 0 ? null : (
        <button
          type="button"
          className="mdview-table-hidden-affordance"
          aria-label={`${hidden.length} hidden columns`}
          onClick={stopHeaderGesture}
          onPointerDown={stopHeaderGesture}
        >
          <span aria-hidden="true" data-md-table-hidden-count={hidden.length} />
        </button>
      )}
    </div>
  );
}

function SortButton({ tableGrid, col }: { readonly tableGrid: Grid<MarkdownTableRow>; readonly col: string }): ReactNode {
  const state = useSignal(tableGrid.state.$);
  const sort = state.sort.find((entry) => entry.field === col)?.sort;
  return (
    <button
      type="button"
      className="mdview-table-action mdview-table-action-sort"
      aria-label={`Sort column ${sort === "asc" ? "descending" : "ascending"}`}
      aria-pressed={sort !== undefined}
      onClick={(event) => {
        event.stopPropagation();
        tableGrid.dispatch({ phase: "intent", type: "header.click", col, mods: plainModifiers });
      }}
      onPointerDown={stopHeaderGesture}
    >
      <span aria-hidden="true" data-md-table-sort={sort ?? "none"} />
    </button>
  );
}

function HeaderActions({ tableGrid, col }: { readonly tableGrid: Grid<MarkdownTableRow> | undefined; readonly col: string }): ReactNode {
  if (tableGrid === undefined) return null;
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [rect, setRect] = useState<{ readonly left: number; readonly top: number; readonly width: number }>();
  useLayoutEffect(() => {
    const anchor = anchorRef.current?.closest<HTMLElement>(".sg-head-cell");
    if (anchor === null || anchor === undefined) return;
    const update = (): void => {
      const box = anchor.getBoundingClientRect();
      setRect((current) => current?.left === box.left && current.top === box.top && current.width === box.width
        ? current
        : { left: box.left, top: box.top, width: box.width });
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(anchor);
    const scrollParent = anchor.closest<HTMLElement>(".sg-scroll");
    scrollParent?.addEventListener("scroll", update, { passive: true });
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      scrollParent?.removeEventListener("scroll", update);
      window.removeEventListener("scroll", update);
    };
  }, [col]);
  return (
    <span
      ref={anchorRef}
      className="mdview-table-header-actions"
      role="group"
      aria-label="Column actions"
      onPointerDown={stopHeaderGesture}
      style={{
        "--md-table-header-left": rect === undefined ? undefined : `${rect.left}px`,
        "--md-table-header-top": rect === undefined ? undefined : `${rect.top}px`,
        "--md-table-header-width": rect === undefined ? undefined : `${rect.width}px`,
      } as CSSProperties}
    >
      <span className="mdview-table-actions-wide">
        <SortButton tableGrid={tableGrid} col={col} />
        <ColumnVisibilityMenu tableGrid={tableGrid} />
      </span>
      <details className="mdview-table-actions-compact">
        <summary aria-label="More column actions" onClick={stopHeaderGesture} onPointerDown={stopHeaderGesture}><span aria-hidden="true" /></summary>
        <div className="mdview-table-actions-compact-menu">
          <SortButton tableGrid={tableGrid} col={col} />
          <ColumnVisibilityMenu tableGrid={tableGrid} />
        </div>
      </details>
    </span>
  );
}

function MarkdownTableHeader({
  header,
  tableGrid,
  col,
  alignment,
}: {
  readonly header: ReactNode;
  readonly tableGrid: Grid<MarkdownTableRow> | undefined;
  readonly col: string;
  readonly alignment: "left" | "center" | "right";
}): ReactNode {
  return (
    <span
      className="mdview-table-header-cell"
      style={{
        textAlign: alignment,
      } as CSSProperties}
    >
      <span className="mdview-table-header-label">{header}</span>
      <HeaderActions tableGrid={tableGrid} col={col} />
    </span>
  );
}

const columnsOf = (model: MarkdownTableModel): readonly ColumnDef<MarkdownTableRow>[] =>
  model.headers.map((header, index) => {
    const longest = model.rows.reduce((length, row) => Math.max(length, row.values[index]?.length ?? 0), model.headerValues[index]?.length ?? 0);
    const compact = longest <= 24;
    return ({
    id: columnId(index),
    header: model.headerValues[index] ?? `Column ${index + 1}`,
    value: (row) => row.values[index] ?? "",
    width: compact ? Math.max(96, longest * 8 + 32) : 280,
    minWidth: 96,
    flex: compact ? undefined : Math.min(3, Math.max(1, Math.ceil(longest / 80))),
    sortable: true,
    resizable: true,
    movable: true,
    headerCell: reactSlot(({ grid: tableGrid, col }) => (
      <MarkdownTableHeader
        header={header}
        tableGrid={tableGrid}
        col={col}
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
  return grid<MarkdownTableRow>({
    id,
    rows: model.rows,
    columns: columnsOf(model),
    rowId: (row) => row.id,
    rowMeasure: { initial: 48, bufferPx: 360 },
    state: tableState,
  });
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

export default function MarkdownTable({ children, model: suppliedModel, tableState }: MarkdownTableProps): ReactNode {
  const model = useMemo(() => suppliedModel ?? markdownTableModel(children), [children, suppliedModel]);
  const tableId = useId().replaceAll(":", "");
  const tableGrid = useTableGrid(model, `markdown-table-${tableId}`, tableState);
  return (
    <section className="mdview-table" aria-label="Markdown table">
      <GridView grid={tableGrid} className="mdview-table-grid" />
    </section>
  );
}

export { columnsOf, markdownTableModel, sameModel };
