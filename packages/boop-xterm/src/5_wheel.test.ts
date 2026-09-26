// @vitest-environment jsdom
import { Signal } from "@hafley66/signals";
import { of } from "rxjs";
import { TestScheduler } from "rxjs/testing";
import { describe, expect, it } from "vitest";
import type { PaneRuntimeState } from "./3_ports.js";
import { wheelStream } from "./5_wheel.js";
import { testPorts } from "./test/0_endpointTransport.js";
import { testTerminal } from "./test/1_terminal.js";

function runtime() {
  return Signal<PaneRuntimeState>({ viewportRevision: 0, selection: { selection: null, captured: [], anchor: null, dragging: false } });
}

function wheel(deltaY: number, shiftKey = false) {
  return new WheelEvent("wheel", { deltaY, deltaMode: WheelEvent.DOM_DELTA_LINE, shiftKey, cancelable: true });
}

describe("wheelStream", () => {
  it("tracked mouse forwards native wheel and routes Shift wheel to tmux", () => {
    const scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
    scheduler.run(({ animate }) => {
      animate("x".repeat(12));
      const terminal = testTerminal();
      const requests: Array<{ frame: number; body: unknown }> = [];
      const ports = testPorts((request) => {
        if (request.url === "scroll_session") requests.push({ frame: scheduler.frame, body: request.body });
        return of({ status: 200, body: null });
      });
      const model = wheelStream(terminal.term, { id: "p", target: "tmux:1", socket: null }, runtime(), ports);
      const states: Array<{ frame: number; native: boolean; wheels: number }> = [];
      const subscription = model.effects.subscribe();
      const state = model.state.$.subscribe((value) => states.push({ frame: scheduler.frame, native: value.native, wheels: value.wheels }));
      scheduler.schedule(() => {
        terminal.setMouseMode("any");
        terminal.fire("write");
        expect(terminal.wheel(wheel(2))).toBe(true);
      }, 2);
      scheduler.schedule(() => expect(terminal.wheel(wheel(2, true))).toBe(false), 4);
      scheduler.schedule(() => { state.unsubscribe(); subscription.unsubscribe(); }, 10);
      scheduler.flush();
      expect(requests).toEqual([{ frame: 5, body: { name: "tmux:1", up: false, lines: 2 } }]);
      expect(states.filter((value) => value.wheels > 0).map((value) => [value.native, value.wheels])).toEqual([[true, 1], [false, 2]]);
    });
  });

  it("rapid wheels aggregate by frame and mutation writes remain sequential", () => {
    const scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
    scheduler.run(({ animate, cold }) => {
      animate("x".repeat(20));
      const terminal = testTerminal();
      const calls: Array<{ frame: number; body: unknown }> = [];
      const ports = testPorts((request) => {
        if (request.url === "scroll_session") {
          calls.push({ frame: scheduler.frame, body: request.body });
          return cold("---a|", { a: { status: 200, body: null } });
        }
        return of({ status: 200, body: null });
      });
      const model = wheelStream(terminal.term, { id: "p", target: "tmux:1", socket: null }, runtime(), ports);
      const subscription = model.effects.subscribe();
      scheduler.schedule(() => { terminal.wheel(wheel(1)); terminal.wheel(wheel(2)); terminal.wheel(wheel(3)); }, 2);
      scheduler.schedule(() => terminal.wheel(wheel(-2)), 4);
      scheduler.schedule(() => subscription.unsubscribe(), 15);
      scheduler.flush();
      expect(calls).toEqual([
        { frame: 3, body: { name: "tmux:1", up: false, lines: 6 } },
        { frame: 6, body: { name: "tmux:1", up: true, lines: 2 } },
      ]);
    });
  });
});
