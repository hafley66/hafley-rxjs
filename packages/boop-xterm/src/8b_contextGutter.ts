import { Signal } from "@hafley66/signals";
import type { Terminal } from "@xterm/xterm";
import { Observable, animationFrameScheduler, auditTime, defer, finalize, map, merge, startWith, tap } from "rxjs";
import { gutter_offset_px, structuredSelectables, type GutterPaint, type StructuredSelectable } from "./1_contextGutterPure.js";
import { gutterLeft, readRowGeometry, rowOnScreen, rowTop, shiftSpans, TerminalScanShift } from "./1_rowGeometry.js";
import type { LineAnchorModel, TurnVisibilityModel } from "./3_ports.js";
import type { ContextQueueModel } from "./8a_contextQueue.js";

export type ContextGutterModel = {
  paint: Signal<GutterPaint | undefined>;
  selectables: Signal<ReadonlyMap<string, StructuredSelectable>>;
  effects: Observable<void>;
};

export function contextGutterStream(
  term: Terminal, host: HTMLElement, queue: ContextQueueModel, visibility: TurnVisibilityModel, anchors: LineAnchorModel,
): ContextGutterModel {
  const paint = Signal<GutterPaint | undefined>(undefined);
  const selectables = Signal<ReadonlyMap<string, StructuredSelectable>>(new Map());
  const effects = defer(() => {
    const scan = new TerminalScanShift(term);
    const checkboxes = new Map<string, HTMLInputElement>();
    const terminal$ = new Observable<void>((subscriber) => {
      const scroll = term.onScroll(() => subscriber.next());
      const resize = term.onResize(() => subscriber.next());
      const write = term.onWriteParsed(() => subscriber.next());
      return function unsubscribe() { scroll.dispose(); resize.dispose(); write.dispose(); };
    });
    const change$ = visibility.changes.$.pipe(tap(() => scan.mark()));
    const dom$ = new Observable<void>((subscriber) => {
      const onChange = (event: Event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;
        const id = target.dataset.regionId;
        const selectable = id && selectables.$().get(id);
        if (selectable) { queue.structuredToggle.$({ selectable, checked: target.checked }); subscriber.next(); }
      };
      const onMouseDown = (event: MouseEvent) => {
        if (event.target instanceof Element && event.target.closest(".term-context-structured-check")) event.stopPropagation();
      };
      queue.gutter.addEventListener("change", onChange);
      queue.gutter.addEventListener("mousedown", onMouseDown);
      return function unsubscribe() {
        queue.gutter.removeEventListener("change", onChange);
        queue.gutter.removeEventListener("mousedown", onMouseDown);
      };
    });
    const repaint$ = merge(terminal$, change$, anchors.state.visible.$, queue.state.$, queue.enabled.$).pipe(
      startWith(undefined), auditTime(0, animationFrameScheduler),
      tap(() => {
        const geometry = readRowGeometry(term, host);
        if (!geometry) return;
        const lines = anchors.state.visible.$();
        const turns = queue.enabled.$() ? shiftSpans(visibility.state.visible.$(), scan.shift()) : [];
        const next = structuredSelectables(turns, lines);
        const byId = new Map(next.map((item) => [item.id, item]));
        selectables.$(byId);
        const token = getComputedStyle(host).getPropertyValue("--boop-xterm-gutter-offset");
        const offset = Number.parseFloat(token) || gutter_offset_px;
        for (const item of next) {
          let checkbox = checkboxes.get(item.id);
          if (!checkbox) {
            checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.className = "term-context-structured-check";
            checkbox.dataset.regionId = item.id;
            checkbox.title = item.kind === "heading" ? "Add heading to next prompt" : `Add ${item.kind} row to next prompt`;
            queue.gutter.append(checkbox);
            checkboxes.set(item.id, checkbox);
          }
          checkbox.dataset.turnId = item.turnId;
          checkbox.hidden = !rowOnScreen(geometry, item.bufferRow);
          checkbox.checked = queue.state.items.$().some((queued) => queued.id === item.id);
          const line = lines.find((candidate) => candidate.bufferStart <= item.bufferRow && item.bufferRow <= candidate.bufferEnd);
          if (line) checkbox.dataset.terminalLineId = line.id;
          checkbox.dataset.bufferRow = String(item.bufferRow);
          checkbox.style.left = `${gutterLeft(geometry, offset)}px`;
          checkbox.style.top = `${rowTop(geometry, item.bufferRow)}px`;
        }
        const liveTurns = new Set(turns.map((turn) => turn.id));
        for (const [id, checkbox] of checkboxes) {
          if (byId.has(id)) continue;
          checkbox.hidden = true;
          if (liveTurns.has(checkbox.dataset.turnId ?? "")) continue;
          checkbox.remove();
          checkboxes.delete(id);
        }
        paint.$({ geometry, turns, lines });
      }), map(() => void 0),
    );
    return merge(dom$, repaint$).pipe(map(() => void 0), finalize(() => {
      scan.dispose();
      for (const checkbox of checkboxes.values()) checkbox.remove();
      paint.$(undefined);
      selectables.$(new Map());
    }));
  });
  return { paint, selectables, effects };
}
