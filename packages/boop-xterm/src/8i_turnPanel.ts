import { MarkdownBody } from "@hafley66/md";
import { Signal, toSignal, type SignalSource } from "@hafley66/signals";
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { Observable, defer, finalize, map, merge, switchMap, tap } from "rxjs";
import type { TurnMark } from "./2_agentSquaresMarks.js";

export type { TurnMark } from "./2_agentSquaresMarks.js";
export type TurnPayload = {
  session: string; harness: string; turn: number; ts: number; role: string; said: string;
};
export type TurnPanelTarget = {
  id: string; source: string; at: string; preview: string; marks: TurnMark;
  turn?: TurnPayload; x: number; y: number;
};
export type TurnPanelModel = {
  opened: Signal<TurnPanelTarget | undefined>;
  favoriteToggle: Signal<TurnPanelTarget | undefined>;
  tagEdit: Signal<TurnPanelTarget | undefined>;
  effects: Observable<void>;
};

const escapeText = /\u001b\[[0-9;]*[A-Za-z]|\\x1b\[[0-9;]*[A-Za-z]|\\u001b\[[0-9;]*[A-Za-z]/g;

export function turnPanelStream(
  host: HTMLElement, opened: Signal<TurnPanelTarget | undefined>,
  marks: SignalSource<ReadonlyMap<string, TurnMark>>,
): TurnPanelModel {
  const favoriteToggle = Signal<TurnPanelTarget>();
  const tagEdit = Signal<TurnPanelTarget>();
  const currentMarks = toSignal(marks);
  const effects = opened.$.pipe(switchMap((target) => {
    if (!target) return new Observable<void>((subscriber) => { subscriber.complete(); });
    return defer(() => {
      const card = document.createElement("div");
      card.className = "turn-panel";
      card.role = "dialog";
      const head = document.createElement("div");
      head.className = "turn-panel-head";
      const at = document.createElement("div");
      at.className = "turn-panel-at";
      at.textContent = target.at;
      const star = document.createElement("button");
      star.type = "button";
      star.className = "turn-panel-star";
      head.append(at, star);
      const tagRow = document.createElement("div");
      tagRow.className = "turn-panel-tagrow";
      const tagLane = document.createElement("div");
      tagLane.className = "turn-panel-tags";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "turn-panel-edit";
      edit.textContent = "edit tags";
      tagRow.append(tagLane, edit);
      const body = document.createElement("div");
      body.className = "turn-panel-body";
      card.append(head, tagRow, body);
      host.append(card);
      const react = createRoot(body);
      const text = (target.turn?.said ?? target.preview).replace(escapeText, "").replace(/\\n/g, "\n");
      const channels = getComputedStyle(host).backgroundColor.match(/[\d.]+/g)?.slice(0, 3).map(Number);
      const dark = !!channels && channels.reduce((sum, channel) => sum + channel, 0) < 384;
      flushSync(() => react.render(createElement(MarkdownBody, { source: text, dark })));
      const box = card.getBoundingClientRect();
      card.style.left = `${Math.max(0, Math.min(target.x, host.clientWidth - box.width))}px`;
      card.style.top = `${Math.max(0, Math.min(target.y, host.clientHeight - box.height))}px`;
      const paintMarks = () => {
        const mark = currentMarks.$().get(target.source) ?? target.marks;
        star.textContent = mark.favorite ? "✓ favorited" : "★ favorite";
        star.setAttribute("aria-pressed", String(mark.favorite));
        tagLane.replaceChildren(...(mark.tags.length ? mark.tags.map((tag) => {
          const chip = document.createElement("span");
          chip.className = "turn-panel-tag";
          chip.textContent = `#${tag}`;
          return chip;
        }) : [Object.assign(document.createElement("span"), { className: "turn-panel-none", textContent: "no tags" })]));
      };
      paintMarks();
      const events$ = new Observable<void>((subscriber) => {
        const onStar = () => { favoriteToggle.$(target); subscriber.next(); };
        const onEdit = () => { tagEdit.$(target); subscriber.next(); };
        const onKey = (event: KeyboardEvent) => {
          if (event.key === "Escape" && !document.querySelector(".diagram-lightbox")) opened.$(undefined);
        };
        const onDown = (event: PointerEvent) => {
          const node = event.target;
          if (!(node instanceof Element) || card.contains(node) || node.closest(".diagram-lightbox")) return;
          const rect = node.closest<HTMLElement>("[data-turn], [data-turn-id]");
          if (rect?.dataset.turn === target.id || rect?.dataset.turnId === target.id) return;
          opened.$(undefined);
        };
        star.addEventListener("click", onStar);
        edit.addEventListener("click", onEdit);
        window.addEventListener("keydown", onKey, true);
        document.addEventListener("pointerdown", onDown, true);
        return function unsubscribe() {
          star.removeEventListener("click", onStar);
          edit.removeEventListener("click", onEdit);
          window.removeEventListener("keydown", onKey, true);
          document.removeEventListener("pointerdown", onDown, true);
        };
      });
      return merge(events$, currentMarks.$.pipe(tap(paintMarks), map(() => void 0))).pipe(
        finalize(() => { react.unmount(); card.remove(); }),
      );
    });
  }), map(() => void 0));
  return { opened, favoriteToggle, tagEdit, effects };
}
