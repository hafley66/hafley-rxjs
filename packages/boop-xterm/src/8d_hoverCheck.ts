import type { Terminal } from "@xterm/xterm";
import { Observable, defer, finalize, map, merge, tap } from "rxjs";
import { gutter_check_px, gutter_offset_px } from "./1_contextGutterPure.js";
import { hoverLineId, hoverTargetAt, screenRowAt } from "./2_hoverCheckPure.js";
import { gutterLeft, readRowGeometry, rowTop } from "./1_rowGeometry.js";
import type { LineAnchorModel, VisibleTerminalLine } from "./3_ports.js";
import type { ContextQueueModel } from "./8a_contextQueue.js";
import type { ContextGutterModel } from "./8b_contextGutter.js";

export type HoverCheckModel = { effects: Observable<void> };

export function hoverCheckStream(
  term: Terminal, host: HTMLElement, queue: ContextQueueModel, gutter: ContextGutterModel, anchors: LineAnchorModel,
): HoverCheckModel {
  const effects = defer(() => {
    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "term-context-hover-check";
    check.title = "Add this line to next prompt";
    check.hidden = true;
    queue.gutter.append(check);
    let pointer: { x: number; y: number } | null = null;
    let line: VisibleTerminalLine | null = null;
    const position = () => {
      const geometry = gutter.paint.$()?.geometry ?? readRowGeometry(term, host);
      if (!pointer || !geometry || !queue.enabled.$()) { line = null; check.hidden = true; return; }
      const offset = Number.parseFloat(getComputedStyle(host).getPropertyValue("--boop-xterm-gutter-offset")) || gutter_offset_px;
      const size = Number.parseFloat(getComputedStyle(host).getPropertyValue("--boop-xterm-gutter-check-size")) || gutter_check_px;
      const column = geometry.screen.left - geometry.left + gutterLeft(geometry, offset);
      if (pointer.x >= column && pointer.x < column + size) return;
      const row = screenRowAt(geometry.screen, geometry.rows, pointer.x, pointer.y);
      const next = row === null ? null : hoverTargetAt(anchors.state.visible.$(), geometry.viewportY + row);
      const structured = new Set([...gutter.selectables.$().values()].map((item) => anchors.state.visible.$()
        .find((candidate) => candidate.bufferStart <= item.bufferRow && item.bufferRow <= candidate.bufferEnd)?.id));
      if (!next || structured.has(next.id)) { line = null; check.hidden = true; return; }
      line = next;
      check.dataset.terminalLineId = next.id;
      check.checked = queue.state.items.$().some((item) => item.id === hoverLineId(next));
      check.style.left = `${gutterLeft(geometry, offset)}px`;
      check.style.top = `${rowTop(geometry, next.bufferStart)}px`;
      check.hidden = false;
    };
    const events$ = new Observable<void>((subscriber) => {
      const move = (event: MouseEvent) => {
        if (event.target === check) return;
        if (event.target instanceof Element && event.target.closest(".term-context-queue")) { check.hidden = true; return; }
        pointer = { x: event.clientX, y: event.clientY };
        position(); subscriber.next();
      };
      const leave = () => { pointer = null; line = null; check.hidden = true; subscriber.next(); };
      const down = (event: MouseEvent) => event.stopPropagation();
      const change = () => {
        if (!line) return;
        const id = hoverLineId(line);
        if (check.checked) {
          const start = line.bufferStart;
          const end = line.bufferEnd;
          const turns = gutter.paint.$()?.turns ?? [];
          queue.add.$({ id, kind: "line", text: line.text, turnIds: turns
            .filter((turn) => turn.anchorEnd >= start && turn.anchorStart <= end).map((turn) => turn.id) });
        } else queue.remove.$(id);
        subscriber.next();
      };
      host.addEventListener("mousemove", move);
      host.addEventListener("mouseleave", leave);
      check.addEventListener("mousedown", down);
      check.addEventListener("change", change);
      return function unsubscribe() {
        host.removeEventListener("mousemove", move);
        host.removeEventListener("mouseleave", leave);
        check.removeEventListener("mousedown", down);
        check.removeEventListener("change", change);
      };
    });
    return merge(events$, gutter.paint.$, queue.state.$).pipe(tap(position), map(() => void 0), finalize(() => check.remove()));
  });
  return { effects };
}
