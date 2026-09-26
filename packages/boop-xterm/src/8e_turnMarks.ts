import { Signal } from "@hafley66/signals";
import { Observable, combineLatest, defer, filter, finalize, map, merge, tap } from "rxjs";
import { gutter_offset_px } from "./1_contextGutterPure.js";
import { gutterLeft, rowOnScreen, rowTop } from "./1_rowGeometry.js";
import { markTitle, placeAnnotations, type PlacedAnnotation } from "./3_turnMarksPure.js";
import { placeForks, type PlacedFork } from "./4_forkMarks.js";
import type { ContextQueueModel } from "./8a_contextQueue.js";
import type { ContextGutterModel } from "./8b_contextGutter.js";
import type { ContextSyncModel } from "./8c_contextSync.js";

export type TurnMarksModel = {
  placedForks: Signal<PlacedFork[]>;
  menuRequested: Signal<{ clientX: number; clientY: number; entries: PlacedAnnotation[] } | undefined>;
  effects: Observable<void>;
};

export function turnMarksStream(
  _host: HTMLElement, queue: ContextQueueModel, gutter: ContextGutterModel, sync: ContextSyncModel,
): TurnMarksModel {
  const placedForks = Signal<PlacedFork[]>([]);
  const menuRequested = Signal<{ clientX: number; clientY: number; entries: PlacedAnnotation[] }>();
  const effects = defer(() => {
    const layer = document.createElement("div");
    layer.className = "term-context-marks";
    queue.gutter.append(layer);
    const marks = new Map<string, HTMLButtonElement>();
    const placedByKey = new Map<string, PlacedAnnotation[]>();
    const events$ = new Observable<void>((subscriber) => {
      const down = (event: MouseEvent) => {
        if (event.target instanceof Element && event.target.closest(".term-context-mark")) event.stopPropagation();
      };
      const click = (event: MouseEvent) => {
        const key = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>("[data-comment-ids]")?.dataset.commentIds : undefined;
        const entries = key && placedByKey.get(key);
        if (!entries) return;
        let first: string | undefined;
        for (const { comment, turn } of entries) {
          const id = `selection:${crypto.randomUUID()}`;
          queue.add.$({ id, text: comment.quote, note: comment.note ?? undefined, turnIds: [turn.id] });
          first ??= id;
        }
        if (first) queue.focusNote.$(first);
        subscriber.next();
      };
      const menu = (event: MouseEvent) => {
        const key = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>("[data-comment-ids]")?.dataset.commentIds : undefined;
        const entries = key && placedByKey.get(key);
        if (!entries) return;
        event.preventDefault(); event.stopPropagation();
        menuRequested.$({ clientX: event.clientX, clientY: event.clientY, entries });
        subscriber.next();
      };
      layer.addEventListener("mousedown", down);
      layer.addEventListener("click", click);
      layer.addEventListener("contextmenu", menu);
      return function unsubscribe() {
        layer.removeEventListener("mousedown", down);
        layer.removeEventListener("click", click);
        layer.removeEventListener("contextmenu", menu);
      };
    });
    const paint$ = combineLatest([gutter.paint.$, sync.annotations.$, sync.forks.$, queue.enabled.$]).pipe(
      filter(([paint]) => paint !== undefined),
      tap(([paint, annotations, forks, enabled]) => {
        if (!paint) return;
        const placed = enabled ? placeAnnotations(annotations, paint.turns, paint.lines) : [];
        placedForks.$(placeForks(placed, forks));
        const byRow = new Map<number, PlacedAnnotation[]>();
        for (const entry of placed) byRow.set(entry.bufferRow, [...byRow.get(entry.bufferRow) ?? [], entry]);
        placedByKey.clear();
        const offset = Number.parseFloat(getComputedStyle(_host).getPropertyValue("--boop-xterm-gutter-offset")) || gutter_offset_px;
        for (const [row, entries] of byRow) {
          const key = entries.map((entry) => entry.comment.clientId).join(" ");
          placedByKey.set(key, entries);
          let mark = marks.get(key);
          if (!mark) {
            mark = document.createElement("button");
            mark.type = "button";
            mark.className = "term-context-mark";
            mark.dataset.commentIds = key;
            marks.set(key, mark);
            layer.append(mark);
          }
          mark.textContent = entries.length > 1 ? `✎${entries.length}` : "✎";
          mark.title = markTitle(entries);
          mark.dataset.bufferRow = String(row);
          mark.hidden = !rowOnScreen(paint.geometry, row);
          mark.style.left = `${gutterLeft(paint.geometry, offset + 18)}px`;
          mark.style.top = `${rowTop(paint.geometry, row)}px`;
        }
        for (const [key, mark] of marks) {
          if (placedByKey.has(key)) continue;
          mark.remove(); marks.delete(key);
        }
      }), map(() => void 0),
    );
    return merge(events$, paint$).pipe(finalize(() => {
      layer.remove(); marks.clear(); placedByKey.clear(); placedForks.$([]);
    }));
  });
  return { placedForks, menuRequested, effects };
}
