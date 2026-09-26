/// <reference types="vite/client" />
import "./theme.css";
import { Signal } from "@hafley66/signals";
import { EMPTY } from "rxjs";
import { describe, expect, it } from "vitest";
import type { TurnVisibilityEvent } from "./2_turnLocate.js";
import type { VisibleTurn } from "./0_types.js";
import { defaultTerminalDiagramLayout } from "./1_terminalDiagrams.js";
import { diagramOverlayStream } from "./8a_diagramOverlay.js";
import { nextFrame, openRealTerminal, waitFor, writeTerminal } from "./test/1_realTerminal.js";

function rig() {
  const { term, host } = openRealTerminal();
  host.style.backgroundColor = "#0f172a";
  const visibility = {
    state: Signal({ visible: [] as VisibleTurn[] }),
    changes: Signal<TurnVisibilityEvent>(),
    scanning: Signal(false),
    settled: Signal<void>(),
    effects: EMPTY,
  };
  const enabled = Signal(true);
  const inference = Signal<"explicit" | "labels" | "inferred">("labels");
  const scrollGesture = Signal<void>();
  const activate = Signal<void>();
  const model = diagramOverlayStream(term, host, visibility, {
    enabled, inference, scrollGesture, activate, layout: defaultTerminalDiagramLayout,
  });
  const subscription = model.effects.subscribe();
  return { term, host, visibility, enabled, inference, scrollGesture, activate, model, subscription };
}
const source = "```mermaid\r\nflowchart LR\r\n  A --> B\r\n```";

describe("diagram overlay on a real terminal", () => {
  it("paints a terminal fence on write even when the ledger has no turn", async () => {
    const { term, host, subscription } = rig();
    await writeTerminal(term, source);
    await waitFor(() => !!host.querySelector(".term-diagram svg"), 10_000);
    const element = host.querySelector<HTMLElement>(".term-diagram");
    expect({ language: element?.dataset.language, start: element?.dataset.bufferStart,
      hidden: host.querySelector<HTMLElement>(".term-diagrams")?.hidden }).toMatchInlineSnapshot(`
        {
          "hidden": false,
          "language": "mermaid",
          "start": "0",
        }
      `);
    subscription.unsubscribe();
    expect(host.querySelector(".term-diagrams")).toBeNull();
  });
  it("leaves a painted overlay alone on a write that changes nothing", async () => {
    const { term, host, subscription } = rig();
    await writeTerminal(term, source);
    await waitFor(() => !!host.querySelector(".term-diagram svg"), 10_000);
    const element = host.querySelector(".term-diagram");
    await writeTerminal(term, "");
    await nextFrame();
    expect(host.querySelector(".term-diagram")).toBe(element);
    expect(host.querySelector<HTMLElement>(".term-diagrams")?.hidden).toBe(false);
    subscription.unsubscribe();
  });
  it("unhides on activate even when nothing about the fences changed", async () => {
    const { term, host, activate, subscription } = rig();
    await writeTerminal(term, source);
    await waitFor(() => !!host.querySelector(".term-diagram svg"), 10_000);
    activate.$(undefined);
    await waitFor(() => host.querySelector<HTMLElement>(".term-diagrams")?.hidden === false);
    expect(host.querySelectorAll(".term-diagram")).toHaveLength(1);
    subscription.unsubscribe();
  });
  it("holds the root hidden across paints while the wheel is active", async () => {
    const { term, host, scrollGesture, subscription } = rig();
    await writeTerminal(term, source);
    await waitFor(() => !!host.querySelector(".term-diagram svg"), 10_000);
    scrollGesture.$(undefined);
    expect(host.querySelector<HTMLElement>(".term-diagrams")?.hidden).toBe(true);
    await waitFor(() => host.querySelector<HTMLElement>(".term-diagrams")?.hidden === false);
    subscription.unsubscribe();
  });
  it("paints what the overlay's inference setting allows", async () => {
    const { term, host, inference, subscription } = rig();
    await writeTerminal(term, "mermaid\r\nflowchart LR\r\n  A --> B\r\n");
    await waitFor(() => !!host.querySelector(".term-diagram svg"), 10_000);
    inference.$("explicit");
    await waitFor(() => !host.querySelector(".term-diagram"));
    inference.$("labels");
    await waitFor(() => !!host.querySelector(".term-diagram"));
    subscription.unsubscribe();
  });
});

describe("diagram overlay scan and failure behavior", () => {
  it("leaves the root visible on a write that changes nothing", async () => {
    const { term, host, subscription } = rig();
    await writeTerminal(term, source);
    await waitFor(() => !!host.querySelector(".term-diagram svg"), 10_000);
    await writeTerminal(term, "");
    await nextFrame();
    expect(host.querySelector<HTMLElement>(".term-diagrams")?.hidden).toBe(false);
    subscription.unsubscribe();
  });
  it("leaves the fingerprint unpinned on a failed render and schedules a retry", async () => {
    const { term, host, subscription } = rig();
    const global = window as Window & { mermaid?: { initialize: (options: object) => void; render: (id: string, code: string) => Promise<{ svg: string }> } };
    const original = global.mermaid;
    if (!original) throw new Error("Mermaid was not loaded");
    let attempts = 0;
    global.mermaid = { initialize: (options) => original.initialize(options), render: async (id, code) => {
      attempts++;
      if (attempts === 1) throw new Error("transient renderer failure");
      return original.render(id, code);
    } };
    try {
      await writeTerminal(term, source);
      await waitFor(() => host.querySelector<HTMLElement>(".term-diagrams")?.dataset.diagramError?.includes("transient renderer failure") ?? false, 10_000);
      expect(host.querySelector(".term-diagram")).toBeNull();
      await waitFor(() => !!host.querySelector(".term-diagram svg"), 5_000);
      expect(attempts).toBeGreaterThanOrEqual(2);
    } finally {
      global.mermaid = original;
      subscription.unsubscribe();
    }
  });
  it("paints a stripped fence once the scan that suppressed it settles", async () => {
    const { term, host, visibility, subscription } = rig();
    visibility.scanning.$(true);
    await writeTerminal(term, "mermaid\r\nflowchart LR\r\n  A --> B\r\n");
    await nextFrame();
    expect(host.querySelector(".term-diagram")).toBeNull();
    visibility.scanning.$(false);
    visibility.settled.$(undefined);
    await waitFor(() => !!host.querySelector(".term-diagram svg"), 10_000);
    subscription.unsubscribe();
  });
  it("paints the screenshot's stripped fence over its diagram rows only", async () => {
    const { term, host, subscription } = rig();
    await writeTerminal(term, "mermaid\r\nflowchart LR\r\n  A --> B\r\nProse after the diagram");
    await waitFor(() => !!host.querySelector(".term-diagram svg"), 10_000);
    const element = host.querySelector<HTMLElement>(".term-diagram");
    expect({ start: element?.dataset.bufferStart, end: element?.dataset.bufferEnd }).toEqual({ start: "0", end: "2" });
    subscription.unsubscribe();
  });
  it("paints nothing over the rows when a stripped fence fails to render", async () => {
    const { term, host, subscription } = rig();
    const global = window as Window & { mermaid?: object };
    const original = global.mermaid;
    global.mermaid = { initialize() {}, async render() { throw new Error("invalid diagram"); } };
    try {
      await writeTerminal(term, "mermaid\r\nflowchart LR\r\n  A --> B\r\n");
      await waitFor(() => !!host.querySelector<HTMLElement>(".term-diagrams")?.dataset.diagramError, 10_000);
      expect(host.querySelector(".term-diagram")).toBeNull();
    } finally { global.mermaid = original; subscription.unsubscribe(); }
  });
  it("paints nothing over the rows when an explicit fence fails to render", async () => {
    const { term, host, subscription } = rig();
    const global = window as Window & { mermaid?: object };
    const original = global.mermaid;
    global.mermaid = { initialize() {}, async render() { throw new Error("invalid diagram"); } };
    try {
      await writeTerminal(term, "```mermaid\r\nflowchart LR\r\n  A --> B\r\n```");
      await waitFor(() => !!host.querySelector<HTMLElement>(".term-diagrams")?.dataset.diagramError, 10_000);
      expect(host.querySelector(".term-diagram")).toBeNull();
    } finally { global.mermaid = original; subscription.unsubscribe(); }
  });
  it("keeps a painted stripped fence on screen while later scans run and the pane keeps writing", async () => {
    const { term, host, visibility, subscription } = rig();
    await writeTerminal(term, "mermaid\r\nflowchart LR\r\n  A --> B\r\n");
    await waitFor(() => !!host.querySelector(".term-diagram svg"), 10_000);
    const element = host.querySelector(".term-diagram");
    visibility.scanning.$(true);
    await writeTerminal(term, "\r\nprose after\r\n");
    await nextFrame();
    expect(host.querySelector(".term-diagram")).toBe(element);
    subscription.unsubscribe();
  });
  it("paints a stripped fence a settled scan saw even when the next scan starts before the repaint", async () => {
    const { term, host, visibility, subscription } = rig();
    visibility.scanning.$(true);
    await writeTerminal(term, "mermaid\r\nflowchart LR\r\n  A --> B\r\n");
    await nextFrame();
    expect(host.querySelector(".term-diagram")).toBeNull();
    visibility.scanning.$(false);
    visibility.settled.$(undefined);
    visibility.scanning.$(true);
    await waitFor(() => !!host.querySelector(".term-diagram svg"), 10_000);
    subscription.unsubscribe();
  });
  it("uses host diagram palette tokens while painting", async () => {
    const { term, host, subscription } = rig();
    host.style.setProperty("--boop-xterm-diagram-dark-surface", "#123456");
    await writeTerminal(term, source);
    await waitFor(() => !!host.querySelector(".term-diagram svg"), 10_000);
    expect(host.querySelector<HTMLElement>(".term-diagram")?.innerHTML.toLowerCase()).toContain("#123456");
    subscription.unsubscribe();
  });
});
it("repaints an existing diagram after a host palette change", async () => {
  const { term, host, activate, subscription } = rig();
  await writeTerminal(term, source);
  await waitFor(() => !!host.querySelector(".term-diagram svg"), 10_000);
  const element = host.querySelector<HTMLElement>(".term-diagram");
  host.style.setProperty("--boop-xterm-diagram-dark-surface", "#abcdef");
  activate.$(undefined);
  await waitFor(() => !!element?.innerHTML.toLowerCase().includes("#abcdef"), 10_000);
  expect(host.querySelector(".term-diagram")).toBe(element);
  subscription.unsubscribe();
});
