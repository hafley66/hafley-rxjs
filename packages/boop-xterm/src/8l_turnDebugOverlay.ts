import { toSignal, type SignalSource } from "@hafley66/signals";
import type { Terminal } from "@xterm/xterm";
import { EMPTY, Observable, animationFrameScheduler, auditTime, defer, finalize, map, merge, startWith, switchMap, tap } from "rxjs";
import { turnHue } from "./0_turnHue.js";
import { regionAtBufferRow, type TurnRegionKind } from "./0_turnRegions.js";
import type { VisibleTurn } from "./0_types.js";
import { bufferRowAtClientY, readRowGeometry, rowTop, shiftSpans, TerminalScanShift } from "./1_rowGeometry.js";
import type { TurnVisibilityModel } from "./3_ports.js";
import type { TurnPanelModel } from "./8i_turnPanel.js";

export { shiftSpans, turnHue };
export type RowTag = {
  bufferRow: number; viewportRow: number; turnId: string | null; turn: number | null;
  role: string; confidence: VisibleTurn["confidence"] | null; label: string; hue: number;
  spanStart: boolean; spanEnd: boolean; regionKind: TurnRegionKind | null; pointer: boolean;
};
export type TurnDebugModel = { effects: Observable<void> };

function tagLabel(turn: VisibleTurn, spanStart: boolean, spanEnd: boolean): string {
  const confidence = (turn.confidence[0] ?? "?").toUpperCase();
  const edge = spanStart ? turn.clippedAbove ? "↑" : spanEnd ? "◆" : "┌"
    : spanEnd ? turn.clippedBelow ? "↓" : "└" : "│";
  return `${edge} t${turn.turn} ${turn.role} ${confidence}`;
}
export function rowTags(visible: VisibleTurn[], firstRow: number, rows: number, pointerRow: number | null): RowTag[] {
  const tags: RowTag[] = [];
  for (let index = 0; index < rows; index++) {
    const bufferRow = firstRow + index;
    const turn = visible.find((candidate) => candidate.bufferStart <= bufferRow && bufferRow <= candidate.bufferEnd) ?? null;
    const region = turn ? regionAtBufferRow(turn.regions, bufferRow) : null;
    const spanStart = !!turn && turn.bufferStart === bufferRow;
    const spanEnd = !!turn && turn.bufferEnd === bufferRow;
    tags.push({ bufferRow, viewportRow: index, turnId: turn?.id ?? null, turn: turn?.turn ?? null,
      role: turn?.role ?? "", confidence: turn?.confidence ?? null,
      label: turn ? tagLabel(turn, spanStart, spanEnd) : "·", hue: turn ? turnHue(turn.id) : 0,
      spanStart, spanEnd, regionKind: region?.kind ?? null, pointer: pointerRow === bufferRow });
  }
  return tags;
}

export function turnDebugOverlayStream(
  term: Terminal, host: HTMLElement, visibility: TurnVisibilityModel,
  panel: TurnPanelModel, enabled: SignalSource<boolean>,
): TurnDebugModel {
  const effects = toSignal(enabled).$.pipe(switchMap((active) => {
    if (!active) return EMPTY;
    return defer(() => {
      const root = document.createElement("div");
      root.className = "term-turn-debug";
      host.append(root);
      const scan = new TerminalScanShift(term);
      const nodes: HTMLDivElement[] = [];
      let pointerRow: number | null = null;
      const events$ = new Observable<void>((subscriber) => {
        const move = (event: PointerEvent) => {
          const geometry = readRowGeometry(term, host);
          const row = geometry ? bufferRowAtClientY(geometry, event.clientY) : null;
          if (row !== pointerRow) { pointerRow = row; subscriber.next(); }
        };
        const leave = () => { pointerRow = null; subscriber.next(); };
        const click = (event: MouseEvent) => {
          const row = event.target instanceof Element ? event.target.closest<HTMLElement>(".term-turn-debug-row") : null;
          const id = row?.dataset.turnId;
          if (!id) return;
          const turn = visibility.state.visible.$().find((candidate) => candidate.id === id);
          if (!turn) return;
          const source = `turn:${turn.session}:${turn.turn}`;
          const box = host.getBoundingClientRect();
          const when = new Date(turn.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          const target = { id, source, at: `${turn.role} · turn ${turn.turn} · ${when}`, preview: turn.said,
            marks: { favorite: false, tags: [] }, turn,
            x: event.clientX - box.left, y: event.clientY - box.top };
          panel.opened.$(panel.opened.$()?.id === id ? undefined : target);
          subscriber.next();
        };
        host.addEventListener("pointermove", move);
        host.addEventListener("pointerleave", leave);
        root.addEventListener("click", click);
        const scroll = term.onScroll(() => subscriber.next());
        const resize = term.onResize(() => subscriber.next());
        const write = term.onWriteParsed(() => subscriber.next());
        return function unsubscribe() {
          host.removeEventListener("pointermove", move);
          host.removeEventListener("pointerleave", leave);
          root.removeEventListener("click", click);
          scroll.dispose(); resize.dispose(); write.dispose();
        };
      });
      const changes$ = visibility.changes.$.pipe(tap(() => scan.mark()));
      const paint$ = merge(events$, changes$).pipe(startWith(undefined), auditTime(0, animationFrameScheduler), tap(() => {
        const geometry = readRowGeometry(term, host);
        if (!geometry) return;
        const tags = rowTags(shiftSpans(visibility.state.visible.$(), scan.shift()), geometry.viewportY, geometry.rows, pointerRow);
        while (nodes.length > tags.length) nodes.pop()?.remove();
        while (nodes.length < tags.length) {
          const node = document.createElement("div");
          node.className = "term-turn-debug-row";
          root.append(node);
          nodes.push(node);
        }
        tags.forEach((tag, index) => {
          const node = nodes[index];
          node.textContent = tag.label;
          node.dataset.bufferRow = String(tag.bufferRow);
          node.dataset.turnId = tag.turnId ?? "";
          node.dataset.turn = tag.turn === null ? "" : String(tag.turn);
          node.dataset.role = tag.role;
          node.dataset.confidence = tag.confidence ?? "";
          node.dataset.span = tag.spanStart && tag.spanEnd ? "single" : tag.spanStart ? "start" : tag.spanEnd ? "end" : "body";
          node.dataset.pointer = String(tag.pointer);
          node.dataset.region = String(!!tag.regionKind);
          node.style.setProperty("--boop-xterm-debug-row-hue", String(tag.hue));
          node.style.right = `${geometry.right}px`;
          node.style.top = `${rowTop(geometry, tag.bufferRow)}px`;
          node.style.height = `${geometry.cellHeight}px`;
          node.style.lineHeight = `${geometry.cellHeight}px`;
        });
      }), map(() => void 0));
      return paint$.pipe(finalize(() => { scan.dispose(); root.remove(); }));
    });
  }), map(() => void 0));
  return { effects };
}
