import { Signal, toSignal, type Signal as SignalType } from "@hafley66/signals";
import type { Terminal } from "@xterm/xterm";
import { animationFrameScheduler, auditTime, debounceTime, defer, filter, finalize, map, merge, scan, share, skip, startWith, takeUntil, tap } from "rxjs";
import type { BoopXtermPorts, LineAnchorModel, LineAnchorState, PaneRuntimeState, TerminalLineAnchorEvent, ViewportModel, ViewportSnapshot, VisibleTerminalLine } from "./3_ports.js";

function hashLine(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function terminalLineId(text: string, duplicateIndex = 0): string { return `line-${hashLine(text)}-${duplicateIndex}`; }

function projectLines(term: Terminal, snapshot: ViewportSnapshot, prior: LineAnchorState, previousTop: number): {
  state: LineAnchorState; events: TerminalLineAnchorEvent[]; top: number;
} {
  const top = snapshot.change.viewportY;
  const duplicateCount = new Map<string, number>();
  const next: VisibleTerminalLine[] = snapshot.lines.map((line) => {
    const duplicateIndex = duplicateCount.get(line.text) ?? 0;
    duplicateCount.set(line.text, duplicateIndex + 1);
    return { id: terminalLineId(line.text, duplicateIndex), bufferStart: line.start, bufferEnd: line.end,
      viewportStart: line.start - top, viewportEnd: line.end - top, text: line.text };
  });
  const rowElements = Array.from(term.element?.querySelectorAll<HTMLElement>(".xterm-rows > div") ?? []);
  const elementsByBufferRow = new Map<number, HTMLElement>();
  for (let row = top; row < top + snapshot.change.rows; row++) {
    const element = rowElements[row - top];
    const line = next.find((candidate) => candidate.bufferStart <= row && row <= candidate.bufferEnd);
    if (!element || !line) continue;
    element.dataset.terminalLineId = line.id;
    element.dataset.bufferRow = String(row);
    element.style.setProperty("anchor-name", `--${line.id}`);
    elementsByBufferRow.set(row, element);
  }
  const before = new Map(prior.visible.map((line) => [line.id, line]));
  const after = new Map(next.map((line) => [line.id, line]));
  const events: TerminalLineAnchorEvent[] = [];
  if (Math.abs(top - previousTop) > 1) events.push({ kind: "viewport-jump", previousTop, top });
  if (prior.visible[0] && next[0] && prior.visible[0].id !== next[0].id) {
    events.push({ kind: "top-line-changed", previousId: prior.visible[0].id, id: next[0].id });
  }
  for (const line of next) {
    const previous = before.get(line.id);
    if (!previous) events.push({ kind: "entered", line });
    else if (previous.text !== line.text) events.push({ kind: "changed", line, previousText: previous.text });
    else if (previous.viewportStart !== line.viewportStart) events.push({ kind: "moved", line, previousViewportStart: previous.viewportStart });
  }
  for (const line of prior.visible) if (!after.has(line.id)) events.push({ kind: "exited", id: line.id });
  return { state: { visible: next, settled: false, elementsByBufferRow }, events, top };
}

export function lineAnchorsStream(
  term: Terminal, viewport: ViewportModel, _runtime: SignalType<PaneRuntimeState>, ports: BoopXtermPorts,
): LineAnchorModel {
  const events = Signal<TerminalLineAnchorEvent[]>();
  const initial: LineAnchorState = { visible: [], settled: true, elementsByBufferRow: new Map() };
  const closed$ = toSignal(ports.paneClosed).$.pipe(filter(Boolean));
  const source$ = defer(() => {
    const snapshots$ = viewport.snapshot.$.pipe(share());
    const refresh$ = snapshots$.pipe(auditTime(0, animationFrameScheduler), map((snapshot) => ({ kind: "refresh" as const, snapshot })));
    const settled$ = snapshots$.pipe(skip(1), debounceTime(80), map(() => ({ kind: "settled" as const })));
    return merge(refresh$, settled$).pipe(
      scan((acc, event) => {
        if (event.kind === "settled") return { ...acc, state: { ...acc.state, settled: true }, events: [] as TerminalLineAnchorEvent[] };
        return projectLines(term, event.snapshot, acc.state, acc.top);
      }, { state: initial, events: [] as TerminalLineAnchorEvent[], top: 0 }),
      tap((projected) => { if (projected.events.length) events.$(projected.events); }),
      map((projected) => projected.state),
      takeUntil(closed$),
      finalize(() => {
        for (const element of term.element?.querySelectorAll<HTMLElement>(".xterm-rows > div[data-terminal-line-id]") ?? []) {
          delete element.dataset.terminalLineId;
          delete element.dataset.bufferRow;
          element.style.removeProperty("anchor-name");
        }
      }),
    );
  });
  const state = Signal(source$, initial);
  return { state, events, effects: state.$.pipe(map(() => void 0)) };
}
