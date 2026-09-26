import { toSignal, type SignalSource } from "@hafley66/signals";
import type { Terminal } from "@xterm/xterm";
import { EMPTY, Observable, animationFrameScheduler, auditTime, defer, finalize, map, merge, startWith, switchMap, tap } from "rxjs";
import type { ProjectedTurnRegion } from "./0_turnRegions.js";
import type { TurnVisibilityModel } from "./3_ports.js";

type StructuredRegion = ProjectedTurnRegion & { kind: "table" | "list" };
export type StructuredOverlayModel = { effects: Observable<void> };

function cells(line: string): string[] {
  return line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
}
function escape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
export function structuredRegionMarkup(region: StructuredRegion): string {
  if (region.kind === "table") {
    const lines = region.text.split("\n");
    const headings = cells(lines[0]);
    const body = lines.slice(2).map(cells);
    return `<table><thead><tr>${headings.map((value) => `<th>${escape(value)}</th>`).join("")}</tr></thead>`
      + `<tbody>${body.map((row) => `<tr>${row.map((value) => `<td>${escape(value)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }
  const items = region.text.split("\n").filter((line) => /^\s*(?:[-+*]|\d+[.)])\s+/.test(line));
  return `<ul>${items.map((line) => `<li>${escape(line.replace(/^\s*(?:[-+*]|\d+[.)])\s+/, ""))}</li>`).join("")}</ul>`;
}

export function structuredOverlayStream(
  term: Terminal, host: HTMLElement, visibility: TurnVisibilityModel, enabled: SignalSource<boolean>,
): StructuredOverlayModel {
  const effects = toSignal(enabled).$.pipe(switchMap((active) => {
    if (!active) return EMPTY;
    return defer(() => {
      const root = document.createElement("div");
      root.className = "term-structured-overlays";
      host.append(root);
      const elements = new Map<string, HTMLButtonElement>();
      const regions = new Map<string, StructuredRegion>();
      let modal: HTMLDivElement | null = null;
      const close = () => { modal?.remove(); modal = null; };
      const events$ = new Observable<void>((subscriber) => {
        const onClick = (event: MouseEvent) => {
          const target = event.target;
          if (!(target instanceof Element)) return;
          const id = target.closest<HTMLElement>("[data-region-id]")?.dataset.regionId;
          const region = id && regions.get(id);
          if (region) {
            close();
            modal = document.createElement("div");
            modal.className = "term-structured-modal";
            modal.dataset.kind = region.kind;
            modal.innerHTML = `<section><header>${region.kind.toUpperCase()} · ${escape(region.turnId)}<button aria-label="Close">×</button></header>${structuredRegionMarkup(region)}</section>`;
            document.body.append(modal);
            subscriber.next();
          }
        };
        const onDown = (event: MouseEvent) => {
          if (event.target instanceof Element && event.target.closest("[data-region-id]")) term.focus();
        };
        const onModalClick = (event: MouseEvent) => {
          if (event.target === modal || event.target instanceof Element && event.target.closest(".term-structured-modal button")) close();
        };
        const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
        root.addEventListener("click", onClick);
        root.addEventListener("mousedown", onDown);
        document.addEventListener("click", onModalClick);
        window.addEventListener("keydown", onKey);
        const scroll = term.onScroll(() => subscriber.next());
        const resize = term.onResize(() => subscriber.next());
        const write = term.onWriteParsed(() => subscriber.next());
        return function unsubscribe() {
          root.removeEventListener("click", onClick);
          root.removeEventListener("mousedown", onDown);
          document.removeEventListener("click", onModalClick);
          window.removeEventListener("keydown", onKey);
          scroll.dispose(); resize.dispose(); write.dispose();
        };
      });
      const paint$ = merge(events$, visibility.changes.$).pipe(startWith(undefined), auditTime(0, animationFrameScheduler), tap(() => {
        const screen = host.querySelector<HTMLElement>(".xterm-screen");
        if (!screen) return;
        const hostRect = host.getBoundingClientRect();
        const screenRect = screen.getBoundingClientRect();
        const rowHeight = screenRect.height / term.rows;
        const top = term.buffer.active.viewportY;
        const bottom = top + term.rows - 1;
        const css = getComputedStyle(host);
        const width = Number.parseFloat(css.getPropertyValue("--boop-xterm-structured-button-width"));
        const height = Number.parseFloat(css.getPropertyValue("--boop-xterm-structured-button-height"));
        regions.clear();
        for (const turn of visibility.state.visible.$()) for (const region of turn.regions) {
          if (region.kind !== "table" && region.kind !== "list") continue;
          if (region.bufferEnd < top || region.bufferStart > bottom) continue;
          regions.set(region.id, region as StructuredRegion);
          let element = elements.get(region.id);
          if (!element) {
            element = document.createElement("button");
            element.className = "term-structured-overlay";
            element.tabIndex = -1;
            element.dataset.regionId = region.id;
            elements.set(region.id, element);
            root.append(element);
          }
          element.textContent = `${region.kind === "table" ? "▦ TABLE" : "☷ LIST"} · click to expand`;
          const start = Math.max(top, region.bufferStart);
          const end = Math.min(bottom, region.bufferEnd);
          Object.assign(element.style, {
            left: `${screenRect.left - hostRect.left}px`, top: `${screenRect.top - hostRect.top + (start - top) * rowHeight}px`,
            width: `${Math.min(width, screenRect.width)}px`, height: `${Math.min(rowHeight * height, (end - start + 1) * rowHeight)}px`,
          });
        }
        for (const [id, element] of elements) if (!regions.has(id)) { element.remove(); elements.delete(id); }
      }), map(() => void 0));
      return paint$.pipe(finalize(() => { close(); root.remove(); }));
    });
  }), map(() => void 0));
  return { effects };
}
