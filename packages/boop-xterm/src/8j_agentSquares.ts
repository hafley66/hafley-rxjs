import { Signal, createMutation, toSignal, type Endpoint, type SignalSource } from "@hafley66/signals";
import type { Terminal } from "@xterm/xterm";
import { EMPTY, Observable, animationFrameScheduler, auditTime, buffer, combineLatest, concat, concatMap, defer, distinctUntilChanged, filter, finalize, map, merge, of, pairwise, share, shareReplay, startWith, switchMap, take, takeWhile, tap, throwError } from "rxjs";
import { activateSquare, createSquareVisual, placeSquare, reseedSquare, strengthAt, themedSquareVars, type SquarePalette, type SquareSeed, type SquareVisual } from "./0_agentSquareVisual.js";
import { marksOf, type TurnMark } from "./2_agentSquaresMarks.js";
import { squaresFeed, type SquaresOptions, type Strip, type StripTurn } from "./1_agentSquaresFeed.js";
import { boxMoved, recentOffset, themedSquaresOf, type AgentSquare, type SquareBox } from "./2_agentSquaresModel.js";
import type { BoopXtermPorts } from "./3_ports.js";
import type { TurnPanelModel, TurnPanelTarget } from "./8i_turnPanel.js";

export type AgentSquaresInput = { pty: string; session: string; target: string; socket?: string };
/** One sample per painted frame: how many squares the projection drew and where. */
export type SquaresPainted = { mode: "relative" | "recent" | "none"; squares: number; band: number; track: number; pane: number };
export type AgentSquaresModel = {
  gutterChanged: Signal<void | undefined>;
  painted: Signal<SquaresPainted | undefined>;
  state: Signal<{ frame: Strip | null; recentOffsetPx: number }>;
  effects: Observable<void>;
};
type Entry = {
  el: HTMLDivElement; meta: HTMLDivElement; body: HTMLDivElement; visual: SquareVisual;
  target?: TurnPanelTarget; stamp: string;
};
type Binding = { input: AgentSquaresInput | null; options: SquaresOptions; closed: boolean };

function seedOf(square: AgentSquare): SquareSeed {
  return { id: square.id, kind: square.kind, role: square.role, turn: square.turn,
    hue: square.hue, at: square.at, preview: square.preview };
}
function markLine(mark: TurnMark): string {
  return [mark.favorite ? "★" : "", ...mark.tags.map((tag) => `#${tag}`)].filter(Boolean).join(" ");
}
function bindingKey(binding: Binding): string {
  return binding.closed ? "closed" : binding.input
    ? JSON.stringify([binding.input.pty, binding.input.session, binding.input.target, binding.input.socket,
      binding.options.mode, binding.options.userKeep]) : "off";
}
function command<I, O>(endpoint: Endpoint<I, O>, input: I): Observable<void> {
  return createMutation(endpoint, of(input)).$.pipe(
    filter((result) => result.isSuccess || result.isError), take(1),
    concatMap((result) => result.isError ? throwError(() => result.error) : of(void 0)),
  );
}

export function agentSquaresStream(
  term: Terminal, host: HTMLElement, input: SignalSource<AgentSquaresInput | null>,
  panel: TurnPanelModel, ports: BoopXtermPorts,
): AgentSquaresModel {
  const gutterChanged = Signal<void>();
  const painted = Signal<SquaresPainted>();
  const state = Signal({ frame: null as Strip | null, recentOffsetPx: 0 });
  const source = toSignal(input);
  const options = toSignal(ports.squaresOptions);
  const enabled = toSignal(ports.agentSquaresEnabled);
  const closed = toSignal(ports.paneClosed);
  const favorites = toSignal(ports.favoriteSources);
  const binding$ = combineLatest([source.$, options.$, enabled.$, closed.$]).pipe(
    map(([value, settings, on, done]): Binding => ({ input: on && !done ? value : null, options: settings, closed: done })),
    distinctUntilChanged((a, b) => bindingKey(a) === bindingKey(b)),
    takeWhile((binding) => !binding.closed, true),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
  const mount$ = binding$.pipe(switchMap(({ input: current }) => {
    if (!current) return EMPTY;
    return defer(() => {
      const root = document.createElement("div");
      root.className = "asq-host";
      const strip = document.createElement("div");
      strip.className = "asq-strip";
      const gap = document.createElement("div");
      gap.className = "asq-tool-gap";
      gap.hidden = true;
      strip.append(gap); root.append(strip); host.append(root);
      host.classList.add("asq-open");
      gutterChanged.$(undefined);
      const entries = new Map<string, Entry>();
      const presence = Signal({ pointer: false, focus: false });
      let held: Strip | null = null;
      let drawn: SquareBox | undefined;
      const palette = (): SquarePalette => {
        const css = getComputedStyle(host);
        return { user: css.getPropertyValue("--boop-xterm-squares-user-tone").trim(),
          agent: css.getPropertyValue("--boop-xterm-squares-agent-tone").trim(),
          tool: css.getPropertyValue("--boop-xterm-squares-tool-tone").trim(),
          other: css.getPropertyValue("--boop-xterm-squares-other-tone").trim() };
      };
      const paint = (frame: Strip) => {
        const screen = host.querySelector<HTMLElement>(".xterm-screen");
        const pane = host.getBoundingClientRect();
        const track = screen?.clientHeight || pane.height;
        const cellHeight = screen && term.rows > 0 ? screen.clientHeight / term.rows : pane.height / Math.max(1, term.rows);
        const css = getComputedStyle(host);
        const step = Number.parseFloat(css.getPropertyValue("--boop-xterm-squares-step"));
        const block = frame.layout?.mode === "recent" ? Math.max(0, frame.layout.squares.length - 1) * step : 0;
        const offset = frame.layout?.mode === "recent" ? recentOffset(state.recentOffsetPx.$(), track, block) : 0;
        state.$({ frame, recentOffsetPx: offset });
        const props = themedSquaresOf(frame, { cellHeight, track }, offset, step);
        drawn = { width: Math.round(pane.width), height: Math.round(pane.height) };
        root.dataset.scrollable = String(frame.layout?.mode === "recent" && block > track);
        strip.style.setProperty("--asq-track", `${props.track}px`);
        strip.style.setProperty("--asq-pane", `${pane.height}px`);
        strip.style.setProperty("--asq-pane-w", `${pane.width}px`);
        gap.hidden = !props.gap;
        if (props.gap) gap.style.transform = `translateY(${props.gap.y}px)`;
        painted.$({ mode: frame.layout?.mode ?? "none", squares: props.squares.length, band: props.band,
          track: Math.round(props.track), pane: Math.round(pane.height) });
        if (frame.layout) strip.dataset.mode = frame.layout.mode;
        else delete strip.dataset.mode;
        const marks = marksOf(frame, favorites.$());
        const turns = new Map([...frame.turns, ...frame.pinned].map((turn) => [turn.id, turn]));
        const colors = palette();
        const flip = Number.parseFloat(css.getPropertyValue("--boop-xterm-squares-pop-flip"));
        const anchor = Number.parseFloat(css.getPropertyValue("--boop-xterm-squares-pop-anchor"));
        const kept = new Set<string>();
        props.squares.forEach((square, index) => {
          const turn = turns.get(square.id);
          if (!turn) return;
          kept.add(square.id);
          let entry = entries.get(square.id);
          if (!entry) {
            const el = document.createElement("div");
            el.className = "asq";
            el.tabIndex = 0;
            el.dataset.turn = square.id;
            el.dataset.kind = square.kind;
            const pop = document.createElement("div");
            pop.className = "asq-pop";
            const meta = document.createElement("div");
            meta.className = "asq-pop-meta";
            const body = document.createElement("div");
            body.className = "asq-pop-body";
            pop.append(meta, body); el.append(pop); strip.append(el);
            entry = { el, meta, body, visual: createSquareVisual(seedOf(square)), stamp: "" };
            entries.set(square.id, entry);
          }
          reseedSquare(entry.visual, seedOf(square));
          placeSquare(entry.visual, square.y, square.scale, strengthAt(index, props.active, square.kind));
          activateSquare(entry.visual, square.active);
          const visual = entry.visual.$();
          for (const [name, value] of Object.entries(themedSquareVars(visual, colors))) entry.el.style.setProperty(name, value);
          entry.el.dataset.active = String(visual.active);
          entry.el.title = visual.at;
          if (square.y + flip > pane.height) entry.el.dataset.pop = "up";
          else if (square.y < anchor) entry.el.dataset.pop = "down";
          else delete entry.el.dataset.pop;
          if (square.pinned) entry.el.dataset.band = "true";
          else delete entry.el.dataset.band;
          const mark = marks.get(square.id) ?? { favorite: false, tags: [] };
          const stamp = `${turn.ts}:${square.role}:${mark.favorite}:${mark.tags.join(",")}:${turn.said.length}`;
          if (entry.stamp !== stamp) {
            entry.stamp = stamp;
            entry.target = { id: square.id, source: `turn:${turn.session}:${turn.turn}`, at: square.at,
              preview: square.preview, marks: mark, turn, x: 0, y: 0 };
            entry.meta.textContent = square.at;
            const line = markLine(mark);
            entry.body.textContent = line ? `${line}\n${square.preview}` : square.preview;
          }
        });
        for (const [id, entry] of entries) if (!kept.has(id)) { entry.el.remove(); entries.delete(id); }
      };
      const releaseHeld = () => {
        if (presence.pointer.$() || presence.focus.$() || !held) return;
        const frame = held; held = null; paint(frame);
      };
      const events$ = new Observable<void>((subscriber) => {
        const enter = () => { presence.pointer.$(true); subscriber.next(); };
        const leave = () => { presence.pointer.$(false); releaseHeld(); subscriber.next(); };
        const focusIn = () => { presence.focus.$(true); subscriber.next(); };
        const focusOut = (event: FocusEvent) => {
          if (event.relatedTarget instanceof Node && root.contains(event.relatedTarget)) return;
          presence.focus.$(false); releaseHeld(); subscriber.next();
        };
        const pointerUp = (event: PointerEvent) => {
          const node = event.target instanceof Element ? event.target.closest<HTMLElement>(".asq[data-turn]") : null;
          const entry = node?.dataset.turn ? entries.get(node.dataset.turn) : undefined;
          if (!entry?.target) return;
          const pane = host.getBoundingClientRect();
          panel.opened.$(panel.opened.$()?.id === entry.target.id ? undefined : {
            ...entry.target, x: event.clientX - pane.left, y: event.clientY - pane.top,
          });
          subscriber.next();
        };
        root.addEventListener("pointerenter", enter);
        root.addEventListener("pointerleave", leave);
        root.addEventListener("focusin", focusIn);
        root.addEventListener("focusout", focusOut);
        root.addEventListener("pointerup", pointerUp);
        return function unsubscribe() {
          root.removeEventListener("pointerenter", enter);
          root.removeEventListener("pointerleave", leave);
          root.removeEventListener("focusin", focusIn);
          root.removeEventListener("focusout", focusOut);
          root.removeEventListener("pointerup", pointerUp);
        };
      });
      const wheel$ = new Observable<number>((subscriber) => {
        const wheel = (event: WheelEvent) => {
          if (root.dataset.scrollable !== "true") return;
          event.preventDefault();
          const step = Number.parseFloat(getComputedStyle(host).getPropertyValue("--boop-xterm-squares-step"));
          subscriber.next(event.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? event.deltaY : event.deltaY * step);
        };
        root.addEventListener("wheel", wheel, { passive: false });
        return function unsubscribe() { root.removeEventListener("wheel", wheel); };
      }).pipe(share());
      const wheelPaint$ = wheel$.pipe(buffer(wheel$.pipe(auditTime(0, animationFrameScheduler))), tap((deltas) => {
        state.recentOffsetPx.$(state.recentOffsetPx.$() + deltas.reduce((sum, delta) => sum + delta, 0));
        const frame = held ?? state.frame.$(); held = null;
        if (frame) paint(frame);
      }), map(() => void 0));
      const resize$ = new Observable<ResizeObserverEntry[]>((subscriber) => {
        const observer = new ResizeObserver((items) => subscriber.next(items));
        observer.observe(host);
        return function unsubscribe() { observer.disconnect(); };
      }).pipe(auditTime(0, animationFrameScheduler), tap((items) => {
        const box = items[items.length - 1]?.contentRect;
        if (!box || !boxMoved(drawn, box.width, box.height)) return;
        const frame = held ?? state.frame.$(); held = null;
        if (frame) paint(frame);
      }), map(() => void 0));
      const frames$ = squaresFeed(current.session, ports["squares-update"]).pipe(tap((frame) => {
        if (presence.pointer.$() || presence.focus.$()) held = frame;
        else paint(frame);
      }), map(() => void 0));
      const favorites$ = favorites.$.pipe(tap(() => {
        const frame = state.frame.$();
        if (frame) paint(frame);
      }), map(() => void 0));
      return merge(events$, wheelPaint$, resize$, frames$, favorites$).pipe(finalize(() => {
        root.remove(); host.classList.remove("asq-open");
        state.$({ frame: null, recentOffsetPx: 0 });
        gutterChanged.$(undefined);
      }));
    });
  }));
  const watch$ = binding$.pipe(
    startWith({ input: null, options: options.$(), closed: false } as Binding), pairwise(),
    concatMap(([previous, next]) => concat(
      previous.input ? command(ports.squares_unwatch, { pty: previous.input.pty }) : EMPTY,
      next.input ? command(ports.squares_watch, { ...next.input, options: next.options }) : EMPTY,
    )), map(() => void 0),
  );
  return { gutterChanged, painted, state, effects: merge(mount$, watch$) };
}
