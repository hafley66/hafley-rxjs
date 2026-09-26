import { Signal } from "@hafley66/signals";
import { describe, expect, it } from "vitest";
import { lineAnchorsStream } from "./5_lineAnchors.js";
import { viewportStream } from "./4_viewport.js";
import type { PaneRuntimeState } from "./3_ports.js";
import { emptyTransport, testPorts } from "./test/0_endpointTransport.js";
import { nextFrame, openRealTerminal, waitFor, writeTerminal } from "./test/1_realTerminal.js";

function runtime() {
  return Signal<PaneRuntimeState>({ viewportRevision: 0,
    selection: { selection: null, captured: [], anchor: null, dragging: false } });
}

describe("lineAnchorsStream with a real Terminal", () => {
  it("renderer burst coalesces into one projection and an 80ms quiet settlement", async () => {
    const { term } = openRealTerminal();
    await writeTerminal(term, "first");
    const ports = testPorts(emptyTransport);
    const viewport = viewportStream(term, runtime(), ports);
    const anchors = lineAnchorsStream(term, viewport, runtime(), ports);
    const states: Array<{ text: string; settled: boolean }> = [];
    const subscription = anchors.state.$.subscribe((state) => states.push({
      text: state.visible[0]?.text ?? "", settled: state.settled,
    }));
    await nextFrame();
    const second = writeTerminal(term, "\r\x1b[2Ksecond");
    const third = writeTerminal(term, "\r\x1b[2Kthird");
    await Promise.all([second, third]);
    await waitFor(() => states.some((state) => state.text === "third" && !state.settled));
    await waitFor(() => states.some((state) => state.text === "third" && state.settled));
    expect(states.filter((state) => state.text === "second")).toEqual([]);
    expect(states.filter((state) => state.text === "third").map((state) => state.settled)).toEqual([false, true]);
    subscription.unsubscribe();
  });

  it("duplicate text receives distinct viewport IDs", async () => {
    const { term } = openRealTerminal();
    await writeTerminal(term, "same\r\nsame");
    const ports = testPorts(emptyTransport);
    const viewport = viewportStream(term, runtime(), ports);
    const anchors = lineAnchorsStream(term, viewport, runtime(), ports);
    const subscription = anchors.state.$.subscribe();
    await waitFor(() => anchors.state.visible.$().filter((line) => line.text === "same").length === 2);
    const ids = anchors.state.visible.$().filter((line) => line.text === "same").map((line) => line.id);
    expect(ids).toEqual([expect.stringMatching(/-0$/), expect.stringMatching(/-1$/)]);
    expect(ids[0]).not.toBe(ids[1]);
    subscription.unsubscribe();
  });
});
