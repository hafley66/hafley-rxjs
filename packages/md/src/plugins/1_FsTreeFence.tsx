import { useEffect, useId, useLayoutEffect, useMemo, useRef } from "react";
import { filter, map } from "rxjs";
import { defaultEpics, grid, type ColumnDef, type Grid, type GridAction, type GridEpic, type GridIntent } from "@hafley66/signal-grid";
import { GridView } from "@hafley66/signal-grid/react";
import "@hafley66/signal-grid/theme.css";
import { parseFsTree, type FsTreeNode } from "../lib/0_fsTree.js";
import type { MdFenceProps } from "./0_types.js";
import "./1_fsTree.css";

const extOf = (name: string): string => {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
};

const entryOf = (node: FsTreeNode): HTMLElement => {
  const entry = document.createElement("span");
  entry.className = "mdview-fs-entry";
  entry.dataset.kind = node.kind;
  entry.dataset.ext = node.kind === "file" ? extOf(node.name) : "";
  const icon = entry.appendChild(document.createElement("span"));
  icon.className = "mdview-fs-icon";
  icon.setAttribute("aria-hidden", "true");
  const name = entry.appendChild(document.createElement("span"));
  name.className = "mdview-fs-name";
  name.textContent = node.name;
  if (node.note !== undefined) {
    const note = entry.appendChild(document.createElement("span"));
    note.className = "mdview-fs-note";
    note.textContent = node.note;
  }
  return entry;
};

const COLUMNS: readonly ColumnDef<FsTreeNode>[] = [
  { id: "name", header: "Name", flex: 1, sortable: false, resizable: false, movable: false, cell: (ctx) => entryOf(ctx.data) },
];

type CellClick = Extract<GridIntent, { type: "cell.click" }>;

/** A click on a folder's label flips it, as the glyph does. */
const expandOnFolderClick: GridEpic<FsTreeNode> = (actions$, state, ctx) =>
  actions$.pipe(
    filter((it): it is CellClick => it.phase === "intent" && it.type === "cell.click"),
    filter((it) => !it.interactive && it.mods.button === 0),
    map((it) => it.row),
    filter((row) => ctx.view.flat.$().some((it) => it.key === row && it.hasChildren)),
    map((row): GridAction<FsTreeNode> => {
      const open = state.expanded.$();
      return { phase: "change", type: "expanded", expanded: { ...open, [row]: open[row] !== true } };
    }),
  );

interface HeldTree {
  readonly grid: Grid<FsTreeNode>;
  roots: readonly FsTreeNode[];
  active: boolean;
}

export default function FsTreeFence({ code }: MdFenceProps) {
  const model = useMemo(() => parseFsTree(code), [code]);
  const id = useId().replaceAll(":", "");
  const held = useRef<HeldTree | null>(null);
  held.current ??= {
    grid: grid<FsTreeNode>({
      id: `md-fs-tree-${id}`,
      rows: model.roots,
      columns: COLUMNS,
      rowId: (node) => node.path,
      subRows: (node) => (node.kind === "dir" ? node.children : undefined),
      rowMeasure: { initial: 24 },
      state: { density: "compact", virtualize: { vertical: false, horizontal: false } },
      epics: [...defaultEpics<FsTreeNode>(), expandOnFolderClick],
    }),
    roots: model.roots,
    active: false,
  };
  const current = held.current;

  // A streaming fence re-parses on every chunk; writing rows keeps the open folders.
  useLayoutEffect(() => {
    if (current.roots === model.roots) return;
    current.roots = model.roots;
    current.grid.rows.$(model.roots);
  }, [current, model]);

  // StrictMode unmounts and remounts once; the grid closes only when no remount follows.
  useEffect(() => {
    current.active = true;
    return () => {
      current.active = false;
      queueMicrotask(() => {
        if (!current.active) current.grid.close();
      });
    };
  }, [current]);

  return (
    <section className="mdview-fs-tree" aria-label="File tree" data-format={model.format}>
      <GridView grid={current.grid} className="mdview-fs-tree-grid" />
    </section>
  );
}
