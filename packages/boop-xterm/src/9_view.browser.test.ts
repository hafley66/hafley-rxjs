import "./theme.css";
import { Signal, toSignal } from "@hafley66/signals";
import { of, Subject, type Subscription } from "rxjs";
import { afterEach, expect, it } from "vitest";
import type { Strip } from "./1_agentSquaresFeed.js";
import { createBoopXtermView } from "./9_view.js";
import { testPorts } from "./test/0_endpointTransport.js";
import { openRealTerminal, waitFor, writeTerminal } from "./test/1_realTerminal.js";

const connected: Subscription[] = [];
afterEach(() => { for (const subscription of connected.splice(0)) subscription.unsubscribe(); });

function frame(session: string): Strip {
  const id = `${session}:1`;
  const turn = { id, session, harness: "omp", turn: 1, ts: 1_700_000_000_000,
    role: "assistant", said: "body", bufferStart: 0, bufferEnd: 0, anchorStart: 0, anchorEnd: 0,
    confidence: "anchored" as const };
  return { session, at: 1_700_000_000_000, rows: 20, turns: [turn], pinned: [], tags: {},
    layout: { mode: "recent", rows: 20, squares: [{ id, kind: "agent", y: 0, scale: 1, active: true }] } };
}

function rig() {
  const { term, host } = openRealTerminal();
  const calls: Array<{ url: string; body: unknown }> = [];
  const ports = testPorts((request) => {
    calls.push({ url: request.url, body: request.body });
    if (request.url === "boop_mux_session") return of({ status: 200, body: { session: "s1", harness: "omp" } });
    if (request.url === "boop_mux_capture") return of({ status: 200, body: "" });
    if (["boop_turns", "boop_turns_recent", "boop_locate_turns", "boop_turn_comments",
      "boop_turn_annotations", "boop_turn_comment_forks"].includes(request.url)) return of({ status: 200, body: [] });
    if (request.url === "boop_sync_session") return of({ status: 200, body: { written: 0, dropped: 0 } });
    return of({ status: 200, body: null });
  });
  const frames = new Subject<Strip>();
  ports["squares-update"] = frames;
  const closed = Signal(false);
  ports.paneClosed = closed;
  ports.agentSquaresEnabled = Signal(true);
  const view = createBoopXtermView(term, host, { id: "p1", target: "t1", socket: null, graphics: false }, ports);
  const subscription = view.effects.subscribe();
  connected.push(subscription);
  return { term, host, calls, ports, frames, closed, view, subscription };
}

it("connects every model and releases child nodes after the final unwatch", async () => {
  const { host, calls, closed, subscription } = rig();
  await waitFor(() => calls.some((call) => call.url === "squares_watch"));
  expect([!!host.querySelector(".term-context-root"), !!host.querySelector(".asq-host"),
    !!host.querySelector(".term-diagrams")]).toMatchInlineSnapshot(`[
  true,
  true,
  true,
]`);
  closed.$(true);
  await waitFor(() => calls.some((call) => call.url === "squares_unwatch") && subscription.closed);
  subscription.unsubscribe();
  expect(host.querySelectorAll(".asq-host,.term-context-root,.term-diagrams,.turn-panel,.term-structured-overlays,.term-turn-debug")).toHaveLength(0);
  expect(calls.filter((call) => call.url === "squares_watch").length).toBe(calls.filter((call) => call.url === "squares_unwatch").length);
});

it("unwatches the old session before watching a new one and paints only its frames", async () => {
  const { host, calls, frames, view, closed } = rig();
  await waitFor(() => calls.some((call) => call.url === "squares_watch"));
  frames.next(frame("s1"));
  await waitFor(() => !!host.querySelector('[data-turn="s1:1"]'));
  view.pane.paneSession.data.$({ session: "s2", harness: "omp" });
  await waitFor(() => calls.filter((call) => call.url === "squares_watch").length === 2);
  frames.next(frame("s1"));
  frames.next(frame("s2"));
  await waitFor(() => !!host.querySelector('[data-turn="s2:1"]'));
  expect([calls.filter((call) => call.url.startsWith("squares_")).map((call) => call.url),
    host.querySelector('[data-turn="s1:1"]') === null]).toMatchInlineSnapshot(`[
  [
    "squares_watch",
    "squares_unwatch",
    "squares_watch",
  ],
  true,
]`);
  closed.$(true);
  await waitFor(() => calls.filter((call) => call.url === "squares_unwatch").length === 2);
});

it("uses host token overrides for squares, panel and diagram", async () => {
  const { term, host, frames, calls, view, closed } = rig();
  host.style.backgroundColor = "#0f172a";
  host.style.setProperty("--boop-xterm-squares-agent-tone", "99% 30%");
  host.style.setProperty("--boop-xterm-panel-bg", "#123456");
  host.style.setProperty("--boop-xterm-diagram-dark-bg", "#334455");
  host.style.setProperty("--boop-xterm-diagram-dark-surface", "#abcdef");
  await waitFor(() => calls.some((call) => call.url === "squares_watch"));
  frames.next(frame("s1"));
  await waitFor(() => !!host.querySelector('[data-turn="s1:1"]'));
  const square = host.querySelector<HTMLElement>(".asq")!;
  square.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: 30, clientY: 30 }));
  await waitFor(() => !!host.querySelector(".turn-panel"));
  await writeTerminal(term, "```mermaid\r\nflowchart LR\r\n A --> B\r\n```");
  await waitFor(() => {
    const panel = host.querySelector<HTMLElement>(".turn-panel");
    const diagram = host.querySelector<HTMLElement>(".term-diagram");
    return getComputedStyle(square).backgroundColor === "rgb(61, 1, 152)"
      && !!panel && getComputedStyle(panel).backgroundColor === "rgb(18, 52, 86)"
      && !!diagram?.querySelector("svg")
      && getComputedStyle(diagram).backgroundColor === "rgb(51, 68, 85)"
      && diagram.innerHTML.toLowerCase().includes("#abcdef");
  }, 10_000);
  expect({
    square: getComputedStyle(square).backgroundColor,
    panel: getComputedStyle(host.querySelector<HTMLElement>(".turn-panel")!).backgroundColor,
    diagramBackground: getComputedStyle(host.querySelector<HTMLElement>(".term-diagram")!).backgroundColor,
    diagram: host.querySelector<HTMLElement>(".term-diagram")?.innerHTML.toLowerCase().includes("#abcdef"),
  }).toMatchInlineSnapshot(`
    {
      "diagram": true,
      "diagramBackground": "rgb(51, 68, 85)",
      "panel": "rgb(18, 52, 86)",
      "square": "rgb(61, 1, 152)",
    }
  `);
  closed.$(true);
  await waitFor(() => calls.some((call) => call.url === "squares_unwatch"));
});

it("opens one React turn card, emits its actions, and closes on Escape", async () => {
  const { host, frames, calls, view, closed } = rig();
  await waitFor(() => calls.some((call) => call.url === "squares_watch"));
  frames.next(frame("s1"));
  host.querySelector<HTMLElement>(".asq")!.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
  await waitFor(() => !!host.querySelector(".turn-panel .mdview-streamdown"));
  host.querySelector<HTMLButtonElement>(".turn-panel-star")!.click();
  host.querySelector<HTMLButtonElement>(".turn-panel-edit")!.click();
  expect([view.turnPanel.favoriteToggle.$()?.source, view.turnPanel.tagEdit.$()?.source,
    host.querySelectorAll(".turn-panel").length]).toMatchInlineSnapshot(`[
  "turn:s1:1",
  "turn:s1:1",
  1,
]`);
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await waitFor(() => !host.querySelector(".turn-panel"));
  closed.$(true);
  await waitFor(() => calls.some((call) => call.url === "squares_unwatch"));
});

it("mounts structured and debug overlays from their gates and releases them", async () => {
  const { host, ports, view, closed, calls } = rig();
  const structured = toSignal(ports.structuredOverlayEnabled);
  const debug = toSignal(ports.turnDebugEnabled);
  structured.$(true); debug.$(true);
  const region = { id: "s1:1:table:0", turnId: "s1:1", kind: "table" as const,
    sourceStart: 0, sourceEnd: 2, bufferStart: 0, bufferEnd: 2,
    text: "| A | B |\n| --- | --- |\n| one | two |" };
  view.pane.visibility.state.$({ visible: [{ id: "s1:1", session: "s1", harness: "omp", turn: 1,
    ts: 1_700_000_000_000, role: "assistant", said: region.text,
    bufferStart: 0, bufferEnd: 2, anchorStart: 0, anchorEnd: 2,
    regions: [region], confidence: "anchored", source: "xterm+boop" }] });
  view.pane.visibility.changes.$({ visible: view.pane.visibility.state.visible.$(), entered: [], exited: [] });
  await waitFor(() => !!host.querySelector(".term-structured-overlay") && !!host.querySelector(".term-turn-debug-row"));
  host.querySelector<HTMLButtonElement>(".term-structured-overlay")!.click();
  expect(document.querySelector(".term-structured-modal table")?.textContent).toContain("one");
  document.querySelector<HTMLButtonElement>(".term-structured-modal button")!.click();
  expect(document.querySelector(".term-structured-modal")).toBeNull();
  structured.$(false); debug.$(false);
  await waitFor(() => !host.querySelector(".term-structured-overlays") && !host.querySelector(".term-turn-debug"));
  closed.$(true);
  await waitFor(() => calls.some((call) => call.url === "squares_unwatch"));
});

it("paints host tag edits on an open turn card before the next strip frame", async () => {
  const { host, frames, calls, ports, closed } = rig();
  await waitFor(() => calls.some((call) => call.url === "squares_watch"));
  frames.next(frame("s1"));
  host.querySelector<HTMLElement>(".asq")!.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
  await waitFor(() => !!host.querySelector(".turn-panel .mdview-streamdown"));
  const tags = () => [...host.querySelectorAll(".turn-panel-tag")].map((chip) => chip.textContent);
  const before = tags();
  toSignal(ports.turnTags).$(new Map([["turn:s1:1", ["keep", "review"]]]));
  await waitFor(() => tags().length === 2);
  expect({ before, after: tags() }).toMatchInlineSnapshot(`
    {
      "after": [
        "#keep",
        "#review",
      ],
      "before": [],
    }
  `);
  closed.$(true);
  await waitFor(() => calls.some((call) => call.url === "squares_unwatch"));
});
