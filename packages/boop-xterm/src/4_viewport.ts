import { Signal, toSignal } from "@hafley66/signals";
import type { Terminal } from "@xterm/xterm";
import { Observable, filter, map, merge, takeUntil, tap } from "rxjs";
import type { BoopXtermPorts, PaneRuntimeState, ViewportChange, ViewportGeometry, ViewportModel, ViewportPoint, ViewportSnapshot } from "./3_ports.js";
import type { LogicalLine } from "./0_types.js";
import type { Signal as SignalType } from "@hafley66/signals";

export function bufferRowAtPoint(geometry: ViewportGeometry, point: ViewportPoint): number | null {
  if (point.clientY < geometry.top || point.clientY > geometry.top + geometry.cellHeight * geometry.rows) return null;
  const viewportRow = Math.min(
    geometry.rows - 1,
    Math.max(0, Math.floor((point.clientY - geometry.top) / (geometry.cellHeight || 1))),
  );
  return geometry.viewportY + viewportRow;
}

function readVisibleLogicalLines(term: Terminal): LogicalLine[] {
  const buffer = term.buffer.active;
  const top = buffer.viewportY;
  const end = Math.min(buffer.length - 1, top + term.rows - 1);
  const lines: LogicalLine[] = [];
  let current: LogicalLine | null = null;
  for (let row = top; row <= end; row++) {
    const line = buffer.getLine(row);
    if (!line) continue;
    const continued = buffer.getLine(row + 1)?.isWrapped ?? false;
    const text = line.translateToString(!continued);
    if (line.isWrapped && current) {
      current.text += text;
      current.end = row;
    } else {
      current = { text, start: row, end: row };
      lines.push(current);
    }
  }
  return lines;
}

function snapshot(term: Terminal, change: ViewportChange, visible: boolean): ViewportSnapshot {
  const screen = term.element?.querySelector<HTMLElement>(".xterm-screen");
  const rect = screen?.getBoundingClientRect();
  return {
    change,
    lines: readVisibleLogicalLines(term),
    visible,
    geometry: {
      top: rect?.top ?? Number.NaN,
      cellHeight: rect ? rect.height / term.rows : 0,
      viewportY: term.buffer.active.viewportY,
      rows: term.rows,
    },
  };
}

export function viewportStream(
  term: Terminal, runtime: SignalType<PaneRuntimeState>, ports: BoopXtermPorts,
): ViewportModel {
  const paneVisible = toSignal(ports.paneVisible);
  const closed$ = toSignal(ports.paneClosed).$.pipe(filter(Boolean));
  const changes = Signal<ViewportChange>();
  const event = (kind: ViewportChange["kind"]): ViewportChange => ({
    kind, cols: term.cols, rows: term.rows,
    viewportY: term.buffer.active.viewportY, bufferLength: term.buffer.active.length,
  });
  const write$ = new Observable<ViewportChange>((subscriber) => {
    const registration = term.onWriteParsed(() => subscriber.next(event("write")));
    return () => registration.dispose();
  });
  const scroll$ = new Observable<ViewportChange>((subscriber) => {
    const registration = term.onScroll(() => subscriber.next(event("scroll")));
    return () => registration.dispose();
  });
  const resize$ = new Observable<ViewportChange>((subscriber) => {
    const registration = term.onResize(() => subscriber.next(event("resize")));
    return () => registration.dispose();
  });
  const initial: ViewportChange = { kind: "write", cols: term.cols, rows: term.rows, viewportY: term.buffer.active.viewportY, bufferLength: term.buffer.active.length };
  const source$ = merge(write$, scroll$, resize$).pipe(
    tap((change) => {
      runtime.viewportRevision.$(runtime.viewportRevision.$() + 1);
      changes.$(change);
    }),
    map((change) => snapshot(term, change, paneVisible.$())),
    takeUntil(closed$),
  );
  const retained = Signal(source$, snapshot(term, initial, paneVisible.$()));
  return { snapshot: retained, changes, effects: retained.$.pipe(map(() => void 0)) };
}
