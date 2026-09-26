import { Signal, toSignal, type Signal as SignalType } from "@hafley66/signals";
import type { Terminal } from "@xterm/xterm";
import { Observable, animationFrameScheduler, auditTime, defer, filter, finalize, fromEvent, map, merge, switchMap, takeUntil, takeWhile, tap } from "rxjs";
import type { BoopXtermPorts, PaneRuntimeState, PinnedSelectionModel } from "./3_ports.js";
import { isEmptySelection, joinPinnedRows, lineSpanAt, pinnedRowSpans, wordSpanAt, type PinnedSelection, type SelectionCell } from "./2_pinnedSelectionPure.js";

export function pinnedSelectionStream(
  term: Terminal, host: HTMLElement, runtime: SignalType<PaneRuntimeState>, ports: BoopXtermPorts,
): PinnedSelectionModel {
  const copy = Signal<string>();
  const text = Signal(() => runtime.selection.selection.$() ? joinPinnedRows(runtime.selection.captured.$()) : "");
  const closed$ = toSignal(ports.paneClosed).$.pipe(filter(Boolean));
  const clipboardEnabled = toSignal(ports.clipboardEnabled);
  const effects = defer(() => {
    const root = document.createElement("div");
    root.className = "term-pinned-root";
    host.appendChild(root);
    const geometry = () => {
      const screen = host.querySelector<HTMLElement>(".xterm-screen") ?? host;
      const screenBox = screen.getBoundingClientRect();
      const hostBox = host.getBoundingClientRect();
      return { left: screenBox.left - hostBox.left, top: screenBox.top - hostBox.top,
        pageLeft: screenBox.left, pageTop: screenBox.top,
        cellWidth: screenBox.width / term.cols || 1, cellHeight: screenBox.height / term.rows || 1 };
    };
    const cellAt = (clientX: number, clientY: number): SelectionCell => {
      const box = geometry();
      const rawRow = Math.floor((clientY - box.pageTop) / box.cellHeight);
      const rawCol = Math.floor((clientX - box.pageLeft) / box.cellWidth);
      const row = Math.max(0, Math.min(term.rows - 1, rawRow));
      const col = Math.max(0, Math.min(term.cols - 1, rawCol));
      return { row: term.buffer.active.viewportY + row, col };
    };
    const rowText = (span: { row: number; startCol: number; endCol: number }) => {
      const line = term.buffer.active.getLine(span.row);
      return line ? line.translateToString(false, span.startCol, span.endCol) : "";
    };
    const capture = (selection: PinnedSelection) => pinnedRowSpans(selection, term.cols).map(rowText);
    const clear = () => {
      runtime.selection.$({ selection: null, captured: [], anchor: null, dragging: false });
      root.replaceChildren();
    };
    const settle = () => {
      const value = text.$();
      if (value && clipboardEnabled.$()) copy.$(value);
    };
    const paint = () => {
      const selection = runtime.selection.selection.$();
      if (!selection) { root.replaceChildren(); return; }
      const spans = pinnedRowSpans(selection, term.cols);
      const live = spans.map(rowText);
      const captured = runtime.selection.captured.$();
      if (live.length !== captured.length || live.some((row, index) => row !== captured[index])) {
        clear();
        return;
      }
      const box = geometry();
      const top = term.buffer.active.viewportY;
      const rects = spans.filter((span) => span.row >= top && span.row < top + term.rows);
      while (root.childElementCount > rects.length) root.lastElementChild?.remove();
      while (root.childElementCount < rects.length) {
        const rect = document.createElement("div");
        rect.className = "term-pinned-selection";
        root.appendChild(rect);
      }
      rects.forEach((span, index) => {
        const rect = root.children[index] as HTMLElement;
        rect.style.left = `${box.left + span.startCol * box.cellWidth}px`;
        rect.style.top = `${box.top + (span.row - top) * box.cellHeight}px`;
        rect.style.width = `${(span.endCol - span.startCol) * box.cellWidth}px`;
        rect.style.height = `${box.cellHeight}px`;
      });
    };
    const mouseDown$ = fromEvent<MouseEvent>(host, "mousedown", { capture: true }).pipe(
      filter((event) => event.button === 0 && !event.metaKey && !event.altKey
        && !(event.target instanceof HTMLElement && event.target.closest(".term-diagrams"))),
      tap(clear),
      filter(() => term.modes.mouseTrackingMode !== "none"),
      switchMap((event) => {
        const cell = cellAt(event.clientX, event.clientY);
        if (event.detail >= 2) {
          const line = term.buffer.active.getLine(cell.row);
          const span = line && (event.detail === 2
            ? wordSpanAt(line.translateToString(false), cell.col)
            : lineSpanAt(line.translateToString(false)));
          if (span) {
            const selection = { anchor: { row: cell.row, col: span.startCol }, focus: { row: cell.row, col: span.endCol - 1 } };
            runtime.selection.$({ selection, captured: capture(selection), anchor: null, dragging: false });
            paint();
            settle();
          }
          return new Observable<void>((subscriber) => { subscriber.complete(); });
        }
        runtime.selection.anchor.$(cell);
        const move$ = fromEvent<MouseEvent>(document, "mousemove", { capture: true }).pipe(map((event) => ({ kind: "move" as const, event })));
        const up$ = fromEvent<MouseEvent>(document, "mouseup", { capture: true }).pipe(map((event) => ({ kind: "up" as const, event })));
        return merge(move$, up$).pipe(
          tap((action) => {
            if (action.kind === "up") {
              const dragging = runtime.selection.dragging.$();
              runtime.selection.anchor.$(null);
              runtime.selection.dragging.$(false);
              if (dragging) settle();
              return;
            }
            const anchor = runtime.selection.anchor.$();
            if (!anchor) return;
            const selection = { anchor, focus: cellAt(action.event.clientX, action.event.clientY) };
            if (!runtime.selection.dragging.$() && isEmptySelection(selection)) return;
            runtime.selection.$({ selection, captured: capture(selection), anchor, dragging: true });
          }),
          takeWhile((action) => action.kind !== "up", true),
          takeUntil(ports.selectionClear.$),
          map(() => void 0),
        );
      }),
      map(() => void 0),
    );
    const render$ = new Observable<void>((subscriber) => {
      const registration = term.onRender(() => subscriber.next());
      return () => registration.dispose();
    });
    const resize$ = new Observable<void>((subscriber) => {
      const registration = term.onResize(() => { clear(); subscriber.next(); });
      return () => registration.dispose();
    });
    const clear$ = ports.selectionClear.$.pipe(tap(clear), map(() => void 0));
    return merge(mouseDown$, render$, resize$, clear$).pipe(
      auditTime(0, animationFrameScheduler),
      tap(paint),
      takeUntil(closed$),
      finalize(() => { clear(); root.remove(); }),
    );
  });
  return { text, copy, effects };
}
