import { Signal } from "@hafley66/signals";
import { describe, expect, it } from "vitest";
import { TestScheduler } from "rxjs/testing";
import { lineAnchorsStream } from "./5_lineAnchors.js";
import { viewportStream } from "./4_viewport.js";
import type { PaneRuntimeState } from "./3_ports.js";
import { emptyTransport, testPorts } from "./test/0_endpointTransport.js";
import { testTerminal } from "./test/1_terminal.js";

function runtime() {
  return Signal<PaneRuntimeState>({ viewportRevision: 0, selection: { selection: null, captured: [], anchor: null, dragging: false } });
}

describe("lineAnchorsStream", () => {
  it("renderer burst coalesces into one projection and an 80ms quiet settlement", () => {
    const scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
    scheduler.run(({ animate }) => {
      animate("x".repeat(120));
      const terminal = testTerminal(["first"]);
      const ports = testPorts(emptyTransport);
      const viewport = viewportStream(terminal.term, runtime(), ports);
      const anchors = lineAnchorsStream(terminal.term, viewport, runtime(), ports);
      const states: Array<{ frame: number; lines: string[]; settled: boolean }> = [];
      const subscription = anchors.state.$.subscribe((state) => states.push({
        frame: scheduler.frame, lines: state.visible.map((line) => line.text), settled: state.settled,
      }));
      scheduler.schedule(() => { terminal.setLines(["second"]); terminal.fire("write"); }, 2);
      scheduler.schedule(() => { terminal.setLines(["third"]); terminal.fire("write"); }, 2);
      scheduler.schedule(() => subscription.unsubscribe(), 100);
      scheduler.flush();
      expect(states.filter((state) => state.lines[0] === "second")).toEqual([]);
      expect(states.filter((state) => state.lines[0] === "third").map((state) => state.settled)).toEqual([false, true]);
      expect(states.at(-1)?.frame).toBe(82);
    });
  });

  it("duplicate text receives distinct viewport IDs", () => {
    const scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
    scheduler.run(({ animate }) => {
      animate("xxxx");
      const terminal = testTerminal(["same", "same"]);
      const ports = testPorts(emptyTransport);
      const viewport = viewportStream(terminal.term, runtime(), ports);
      const anchors = lineAnchorsStream(terminal.term, viewport, runtime(), ports);
      const ids: string[][] = [];
      const subscription = anchors.state.visible.$.subscribe((lines) => {
        if (lines.length) ids.push(lines.map((line) => line.id));
      });
      scheduler.schedule(() => subscription.unsubscribe(), 3);
      scheduler.flush();
      expect(ids).toEqual([[expect.stringMatching(/-0$/), expect.stringMatching(/-1$/)]]);
      expect(ids[0][0]).not.toBe(ids[0][1]);
    });
  });
});
