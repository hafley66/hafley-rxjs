import { Signal, createQuery, toSignal, type SignalSource } from "@hafley66/signals";
import type { Terminal } from "@xterm/xterm";
import { EMPTY, Observable, catchError, combineLatest, defer, distinctUntilChanged, exhaustMap, filter, finalize, map, merge, switchMap, take, tap, timer } from "rxjs";
import { FORK_PRESET, type PlacedFork } from "./4_forkMarks.js";
import { forkBodyLines, forkHeaderText, forkKey, forkShape, fork_capture_ms, fork_indent_px, fork_pane_rows, placeForkOverlays, placeForkPanes, tailLines } from "./5_forkRenderPure.js";
import type { BoopXtermPorts } from "./3_ports.js";
import type { ContextGutterModel } from "./8b_contextGutter.js";
import type { TurnMarksModel } from "./8e_turnMarks.js";

export type ForkRenderModel = { effects: Observable<void> };

export function forkRenderStream(
  term: Terminal, host: HTMLElement, gutter: ContextGutterModel, marks: TurnMarksModel,
  livePane: SignalSource<boolean>, ports: BoopXtermPorts,
): ForkRenderModel {
  const live = toSignal(livePane);
  const expanded = Signal<ReadonlySet<string>>(new Set<string>());
  const captures = Signal<ReadonlyMap<string, string>>(new Map());
  const effects = defer(() => {
    const layer = document.createElement("div");
    layer.className = "term-fork-layer";
    host.querySelector(".term-context-gutter")?.append(layer);
    const nodes = new Map<string, { root: HTMLDivElement; header: HTMLButtonElement; body: HTMLPreElement }>();
    const clicks$ = new Observable<void>((subscriber) => {
      const down = (event: MouseEvent) => {
        if (event.target instanceof Element && event.target.closest(".term-fork-header")) event.stopPropagation();
      };
      const click = (event: MouseEvent) => {
        const header = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>(".term-fork-header") : null;
        const key = header?.closest<HTMLElement>("[data-fork-key]")?.dataset.forkKey;
        if (!key || live.$()) return;
        const next = new Set(expanded.$());
        if (next.has(key)) next.delete(key); else next.add(key);
        expanded.$(next);
        subscriber.next();
      };
      layer.addEventListener("mousedown", down);
      layer.addEventListener("click", click);
      return function unsubscribe() { layer.removeEventListener("mousedown", down); layer.removeEventListener("click", click); };
    });
    const placements$ = combineLatest([gutter.paint.$, marks.placedForks.$, live.$]).pipe(
      filter(([paint]) => paint !== undefined),
    );
    const capture$ = placements$.pipe(
      map(([paint, forks, livePane]) => livePane ? forks.filter((fork) => {
        if (!paint) return false;
        const row = fork.bufferRow + 1;
        return row >= paint.geometry.viewportY && row < paint.geometry.viewportY + paint.geometry.rows;
      }) : []),
      distinctUntilChanged((a, b) => JSON.stringify(a.map((fork) => [forkKey(fork.fork), fork.fork.tmux])) === JSON.stringify(b.map((fork) => [forkKey(fork.fork), fork.fork.tmux]))),
      switchMap((forks) => forks.length ? merge(...forks.map((fork) => timer(0, fork_capture_ms).pipe(
        exhaustMap(() => createQuery(ports.boop_mux_capture, { target: fork.fork.tmux, socket: null }, { cacheTime: 0 }).$.pipe(
          filter((result) => result.isSuccess || result.isError), take(1),
          tap((result) => {
            if (!result.isSuccess || result.data === undefined) return;
            const next = new Map(captures.$());
            next.set(forkKey(fork.fork), result.data);
            captures.$(next);
          }),
          catchError(() => EMPTY),
        )),
      ))) : EMPTY),
      map(() => void 0),
    );
    const render$ = combineLatest([placements$, expanded.$, captures.$]).pipe(tap(([[paint, forks, livePane], expandedKeys, saved]) => {
      if (!paint) return;
      const open = expandedKeys ?? new Set<string>();
      const css = getComputedStyle(host);
      const paneRows = Number.parseFloat(css.getPropertyValue("--boop-xterm-fork-pane-rows")) || fork_pane_rows;
      const indent = Number.parseFloat(css.getPropertyValue("--boop-xterm-fork-indent")) || fork_indent_px;
      const shape = forkShape(livePane);
      const placements = livePane
        ? placeForkPanes(paint.geometry, forks, paneRows).map((placement) => ({ ...placement, left: placement.left + indent - fork_indent_px }))
        : placeForkOverlays(paint.geometry, forks);
      const byKey = new Map(forks.map((fork) => [forkKey(fork.fork), fork]));
      const visible = new Set<string>();
      for (const placement of placements) {
        const fork = byKey.get(placement.key);
        if (!fork) continue;
        visible.add(placement.key);
        let node = nodes.get(placement.key);
        if (!node) {
          const root = document.createElement("div");
          root.className = "term-fork";
          root.dataset.forkKey = placement.key;
          const header = document.createElement("button");
          header.className = "term-fork-header";
          header.type = "button";
          const body = document.createElement("pre");
          body.className = "term-fork-body";
          root.append(header, body);
          layer.append(root);
          node = { root, header, body };
          nodes.set(placement.key, node);
        }
        node.root.dataset.shape = shape;
        node.root.dataset.state = fork.fork.state;
        node.root.hidden = !placement.onScreen;
        node.root.style.left = `${placement.left}px`;
        node.root.style.right = `${placement.right}px`;
        node.root.style.top = `${placement.top}px`;
        node.root.style.height = "height" in placement ? `${placement.height}px` : "";
        node.header.textContent = livePane
          ? `tmux ${fork.fork.tmux} · ${FORK_PRESET} · ${fork.fork.state}`
          : forkHeaderText(fork.fork, open.has(placement.key), Date.now());
        node.body.hidden = !livePane && !open.has(placement.key);
        node.body.textContent = livePane ? tailLines(saved.get(placement.key) ?? "", paneRows - 1).join("\n")
          : open.has(placement.key) ? forkBodyLines(fork.fork, term.cols).join("\n") : "";
      }
      for (const [key, node] of nodes) if (!visible.has(key)) { node.root.remove(); nodes.delete(key); }
    }), map(() => void 0));
    return merge(clicks$, capture$, render$).pipe(finalize(() => { layer.remove(); nodes.clear(); }));
  });
  return { effects };
}
