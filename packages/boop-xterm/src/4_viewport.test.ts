import { Signal, toSignal } from "@hafley66/signals";
import { describe, expect, it } from "vitest";
import { TestScheduler } from "rxjs/testing";
import { map } from "rxjs";
import { viewportStream, bufferRowAtPoint } from "./4_viewport.js";
import type { PaneRuntimeState } from "./3_ports.js";
import { testPorts, emptyTransport } from "./test/0_endpointTransport.js";
import { testTerminal } from "./test/1_terminal.js";

const runtime = () => Signal<PaneRuntimeState>({
  viewportRevision: 0, selection: { selection: null, captured: [], anchor: null, dragging: false },
});

describe("viewportStream", () => {
  it("semantic events: initial, write, scroll, resize with one registration each", () => {
    const scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
    scheduler.run(({ expectObservable }) => {
      const terminal = testTerminal(["alpha"]);
      const viewport = viewportStream(terminal.term, runtime(), testPorts(emptyTransport));
      expectObservable(viewport.snapshot.$.pipe(map((value) => value.change.kind)), "^-------!")
        .toBe("a-b-c-d", { a: "write", b: "write", c: "scroll", d: "resize" });
      scheduler.schedule(() => {
        expect([terminal.listeners("write"), terminal.listeners("scroll"), terminal.listeners("resize")]).toEqual([1, 1, 1]);
        terminal.fire("write");
      }, 2);
      scheduler.schedule(() => terminal.fire("scroll"), 4);
      scheduler.schedule(() => terminal.fire("resize"), 6);
      scheduler.schedule(() => expect([terminal.listeners("write"), terminal.listeners("scroll"), terminal.listeners("resize")]).toEqual([0, 0, 0]), 8);
    });
  });

  it("close teardown stops xterm reads", () => {
    const scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
    scheduler.run(({ expectObservable }) => {
      const terminal = testTerminal(["alpha"]);
      const ports = testPorts(emptyTransport);
      const viewport = viewportStream(terminal.term, runtime(), ports);
      expectObservable(viewport.snapshot.$.pipe(map((value) => value.lines[0]?.text)), "^--------!")
        .toBe("a-b-", { a: "alpha", b: "beta" });
      scheduler.schedule(() => { terminal.setLines(["beta"]); terminal.fire("write"); }, 2);
      scheduler.schedule(() => toSignal(ports.paneClosed).$(true), 4);
      scheduler.schedule(() => { terminal.setLines(["gamma"]); terminal.fire("scroll"); }, 6);
      scheduler.schedule(() => expect(terminal.listeners("write")).toBe(0), 8);
    });
  });

  it("maps client coordinates through sampled geometry", () => {
    expect([
      bufferRowAtPoint({ top: 100, cellHeight: 10, viewportY: 40, rows: 20 }, { clientX: 0, clientY: 125 }),
      bufferRowAtPoint({ top: 100, cellHeight: 10, viewportY: 40, rows: 20 }, { clientX: 0, clientY: 90 }),
    ]).toEqual([42, null]);
  });
});
