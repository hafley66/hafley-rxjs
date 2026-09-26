import { Signal, toSignal } from "@hafley66/signals";
import { describe, expect, it } from "vitest";
import { viewportStream, bufferRowAtPoint } from "./4_viewport.js";
import type { PaneRuntimeState } from "./3_ports.js";
import { testPorts, emptyTransport } from "./test/0_endpointTransport.js";
import { openRealTerminal, writeTerminal } from "./test/1_realTerminal.js";

function runtime() {
  return Signal<PaneRuntimeState>({ viewportRevision: 0,
    selection: { selection: null, captured: [], anchor: null, dragging: false } });
}

describe("viewportStream with a real Terminal", () => {
  it("semantic events: initial, write, scroll, resize with one registration each", async () => {
    const { term } = openRealTerminal();
    await writeTerminal(term, Array.from({ length: 30 }, (_, index) => `row ${index}\r\n`).join(""));
    const viewport = viewportStream(term, runtime(), testPorts(emptyTransport));
    const kinds: string[] = [];
    const subscription = viewport.snapshot.$.subscribe((value) => kinds.push(value.change.kind));
    await writeTerminal(term, "after write");
    term.scrollLines(-1);
    term.resize(81, 20);
    expect(kinds[0]).toBe("write");
    expect(kinds).toContain("scroll");
    expect(kinds.at(-1)).toBe("resize");
    expect(kinds.filter((kind) => kind === "resize")).toHaveLength(1);
    subscription.unsubscribe();
  });

  it("close teardown stops xterm reads", async () => {
    const { term } = openRealTerminal();
    await writeTerminal(term, "alpha");
    const ports = testPorts(emptyTransport);
    const root = runtime();
    const viewport = viewportStream(term, root, ports);
    const seen: string[][] = [];
    const subscription = viewport.snapshot.$.subscribe((value) => seen.push(value.lines.map((line) => line.text)));
    await writeTerminal(term, "\r\x1b[2Kbeta");
    expect(seen.at(-1)?.[0]).toBe("beta");
    toSignal(ports.paneClosed).$(true);
    const before = { emissions: seen.length, revision: root.viewportRevision.$() };
    await writeTerminal(term, "\r\x1b[2Kgamma");
    expect({ emissions: seen.length, revision: root.viewportRevision.$() }).toEqual(before);
    subscription.unsubscribe();
  });

  it("maps client coordinates through sampled geometry", async () => {
    const { term } = openRealTerminal();
    await writeTerminal(term, "alpha");
    const viewport = viewportStream(term, runtime(), testPorts(emptyTransport));
    const geometry = viewport.snapshot.geometry.$();
    expect(bufferRowAtPoint(geometry, { clientX: 0, clientY: geometry.top + geometry.cellHeight * 2.5 }))
      .toBe(geometry.viewportY + 2);
    expect(bufferRowAtPoint(geometry, { clientX: 0, clientY: geometry.top - 1 })).toBeNull();
  });

  it("updates the snapshot when host visibility changes without an xterm event", async () => {
    const { term } = openRealTerminal();
    await writeTerminal(term, "alpha");
    const ports = testPorts(emptyTransport);
    const viewport = viewportStream(term, runtime(), ports);
    const values: boolean[] = [];
    const subscription = viewport.snapshot.visible.$.subscribe((value) => values.push(value));
    toSignal(ports.paneVisible).$(false);
    toSignal(ports.paneVisible).$(true);
    expect(values).toEqual([true, false, true]);
    subscription.unsubscribe();
  });
});
