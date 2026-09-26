import { Signal } from "@hafley66/signals";
import type { Terminal } from "@xterm/xterm";
import { defer, finalize, map, of, timer } from "rxjs";
import { describe, expect, it } from "vitest";
import type { PaneRuntimeState } from "./3_ports.js";
import { wheelStream } from "./5_wheel.js";
import { testPorts } from "./test/0_endpointTransport.js";
import { nextFrame, openRealTerminal, waitFor, writeTerminal } from "./test/1_realTerminal.js";

function runtime() {
  return Signal<PaneRuntimeState>({ viewportRevision: 0,
    selection: { selection: null, captured: [], anchor: null, dragging: false } });
}

function wheel(term: Terminal, deltaY: number, shiftKey = false) {
  const screen = term.element?.querySelector<HTMLElement>(".xterm-screen");
  if (!screen) throw new Error("xterm screen missing");
  return screen.dispatchEvent(new WheelEvent("wheel", {
    bubbles: true, cancelable: true, deltaY, deltaMode: WheelEvent.DOM_DELTA_LINE, shiftKey,
  }));
}

describe("wheelStream with a real Terminal", () => {
  it("tracked mouse forwards native wheel and routes Shift wheel to tmux", async () => {
    const { term } = openRealTerminal();
    const requests: unknown[] = [];
    const ports = testPorts((request) => {
      if (request.url === "scroll_session") requests.push(request.body);
      return of({ status: 200, body: null });
    });
    const model = wheelStream(term, { id: "p", target: "tmux:1", socket: null }, runtime(), ports);
    const states: Array<{ native: boolean; wheels: number }> = [];
    const effects = model.effects.subscribe();
    const state = model.state.$.subscribe((value) => states.push({ native: value.native, wheels: value.wheels }));
    await writeTerminal(term, "\x1b[?1000h");
    expect(term.modes.mouseTrackingMode).not.toBe("none");
    wheel(term, 2);
    wheel(term, 2, true);
    await waitFor(() => requests.length === 1);
    expect(requests).toEqual([{ name: "tmux:1", up: false, lines: 2 }]);
    expect(states.filter((value) => value.wheels > 0).map((value) => [value.native, value.wheels]))
      .toEqual([[true, 1], [false, 2]]);
    state.unsubscribe();
    effects.unsubscribe();
  });

  it("rapid wheels aggregate by frame and mutation writes remain sequential", async () => {
    const { term } = openRealTerminal();
    const calls: unknown[] = [];
    let active = 0;
    let maximumActive = 0;
    const ports = testPorts((request) => {
      if (request.url !== "scroll_session") return of({ status: 200, body: null });
      calls.push(request.body);
      return defer(() => {
        active++;
        maximumActive = Math.max(maximumActive, active);
        return timer(80).pipe(
          map(() => ({ status: 200, body: null })),
          finalize(() => { active--; }),
        );
      });
    });
    const model = wheelStream(term, { id: "p", target: "tmux:1", socket: null }, runtime(), ports);
    const subscription = model.effects.subscribe();
    wheel(term, 1);
    wheel(term, 2);
    wheel(term, 3);
    await nextFrame();
    wheel(term, -2);
    await waitFor(() => calls.length === 2);
    expect(calls).toEqual([
      { name: "tmux:1", up: false, lines: 6 },
      { name: "tmux:1", up: true, lines: 2 },
    ]);
    expect(maximumActive).toBe(1);
    subscription.unsubscribe();
  });
});
