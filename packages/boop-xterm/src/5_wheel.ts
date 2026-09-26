import { Signal, createMutation, toSignal, type Signal as SignalType } from "@hafley66/signals";
import type { Terminal } from "@xterm/xterm";
import { Observable, animationFrameScheduler, auditTime, buffer, concatMap, filter, map, merge, of, scan, share, take, takeUntil, tap } from "rxjs";
import type { BoopXtermPorts, PaneIdentity, PaneRuntimeState, WheelModel } from "./3_ports.js";
import { initialTerminalWheelState, reduceTerminalWheel, type TerminalWheelEvent } from "./2_wheelReduce.js";

type WheelInput = { event: TerminalWheelEvent; rows: number };

export function wheelStream(
  term: Terminal, identity: PaneIdentity, _runtime: SignalType<PaneRuntimeState>, ports: BoopXtermPorts,
): WheelModel {
  const activity = Signal<void>();
  const closed$ = toSignal(ports.paneClosed).$.pipe(filter(Boolean));
  const native$ = new Observable<WheelInput>((subscriber) => {
    const parsed = term.onWriteParsed(() => subscriber.next({
      event: { type: "sync", mouseMode: term.modes.mouseTrackingMode }, rows: 0,
    }));
    term.attachCustomWheelEventHandler((event) => {
      const mouseMode = term.modes.mouseTrackingMode;
      const bypass = event.shiftKey;
      const native = mouseMode !== "none" && !bypass;
      let rows = 0;
      if (!native) {
        event.preventDefault();
        const screen = term.element?.querySelector<HTMLElement>(".xterm-screen");
        const cellHeight = screen ? screen.getBoundingClientRect().height / term.rows : 1;
        const pixels = event.deltaMode === WheelEvent.DOM_DELTA_PIXEL
          ? event.deltaY
          : event.deltaMode === WheelEvent.DOM_DELTA_LINE
            ? event.deltaY * cellHeight
            : event.deltaY * cellHeight * term.rows;
        rows = pixels / Math.max(1, cellHeight);
      }
      subscriber.next({ event: { type: "wheel", mouseMode, bypass }, rows });
      return native;
    });
    return () => {
      parsed.dispose();
      term.attachCustomWheelEventHandler(() => true);
    };
  });
  const raw$ = merge(of<WheelInput>({ event: { type: "sync", mouseMode: term.modes.mouseTrackingMode }, rows: 0 }), native$).pipe(
    tap((input) => { if (input.event.type === "wheel") activity.$(undefined); }),
    takeUntil(closed$),
    share(),
  );
  const state = Signal(raw$.pipe(scan((prior, input) => reduceTerminalWheel(prior, input.event), initialTerminalWheelState)), initialTerminalWheelState);
  const appWheels$ = raw$.pipe(filter((input) => input.rows !== 0), share());
  const frames$ = appWheels$.pipe(
    buffer(appWheels$.pipe(auditTime(0, animationFrameScheduler))),
    map((events) => events.reduce((total, input) => total + input.rows, 0)),
    filter((rows) => rows !== 0),
    map((rows) => ({ name: identity.target, up: rows < 0, lines: Math.min(50, Math.max(1, Math.round(Math.abs(rows)))) })),
  );
  const scroll$ = frames$.pipe(
    concatMap((input) => createMutation(ports.scroll_session, input).$.pipe(
      filter((result) => result.isSuccess || result.isError), take(1), map(() => void 0),
    )),
  );
  return { state, activity, effects: merge(state.$.pipe(map(() => void 0)), scroll$) };
}
