import "./theme.css";
import { Signal } from "@hafley66/signals";
import { merge, of, type Subscription } from "rxjs";
import { afterEach, expect, it } from "vitest";
import type { SquareKind } from "./0_agentSquareVisual.js";
import type { Strip, StripLayout, StripTurn } from "./1_agentSquaresFeed.js";
import { agentSquaresStream, type AgentSquaresInput } from "./8j_agentSquares.js";
import { turnPanelStream } from "./8i_turnPanel.js";
import { testPorts } from "./test/0_endpointTransport.js";
import { nextFrame, openRealTerminal, waitFor } from "./test/1_realTerminal.js";

const connected: Subscription[] = [];
afterEach(() => { for (const subscription of connected.splice(0)) subscription.unsubscribe(); });

function recentFrame(count: number, active = -1): Strip {
  const squares = Array.from({ length: count }, (_, index) => ({
    id: `s1:${index + 1}`, kind: "agent" as SquareKind, y: index, scale: 1, active: index === active,
  }));
  const turns: StripTurn[] = squares.map((square, index) => ({
    session: "s1", harness: "omp", turn: index + 1, ts: 1_700_000_000_000 + index,
    role: "assistant", said: "a reply", id: square.id,
    bufferStart: 0, bufferEnd: 0, anchorStart: 0, anchorEnd: 0, confidence: "anchored",
  }));
  const layout: StripLayout = { mode: "recent", rows: 20, squares };
  return { session: "s1", at: 1_700_000_000_000, rows: 20, turns, pinned: [], tags: {}, layout };
}

function rig() {
  const { term, host } = openRealTerminal();
  const ports = testPorts(() => of({ status: 200, body: null }));
  ports.agentSquaresEnabled = Signal(true);
  ports.squaresOptions = Signal<import("./1_agentSquaresFeed.js").SquaresOptions>({ mode: "recent", userKeep: 4 });
  const opened = Signal<import("./8i_turnPanel.js").TurnPanelTarget | undefined>(undefined);
  const panel = turnPanelStream(host, opened, Signal<ReadonlyMap<string, import("./2_agentSquaresMarks.js").TurnMark>>(new Map()));
  const squares = agentSquaresStream(term, host, Signal<AgentSquaresInput | null>({ pty: "p1", session: "s1", target: "t1" }), panel, ports);
  connected.push(merge(panel.effects, squares.effects).subscribe());
  const frames = ports["squares-update"] as import("rxjs").Subject<Strip>;
  return { host, ports, frames, squares };
}

it("scrolls an overflowing recent block from the gutter wheel", async () => {
  const { host, frames } = rig();
  frames.next(recentFrame(40));
  const strip = host.querySelector<HTMLElement>(".asq-host")!;
  const oldest = host.querySelector<HTMLElement>(".asq")!;
  expect(strip.dataset.scrollable).toBe("true");
  const before = Number.parseFloat(oldest.style.getPropertyValue("--asq-y"));
  const wheel = new WheelEvent("wheel", { deltaY: -200, cancelable: true });
  strip.dispatchEvent(wheel);
  await nextFrame(); await nextFrame();
  expect([wheel.defaultPrevented, Number.parseFloat(oldest.style.getPropertyValue("--asq-y")) - before])
    .toMatchInlineSnapshot(`[
  true,
  -200,
]`);
});

it("lets the wheel pass through when the recent block fits", async () => {
  const { host, frames } = rig();
  frames.next(recentFrame(5));
  const strip = host.querySelector<HTMLElement>(".asq-host")!;
  const oldest = host.querySelector<HTMLElement>(".asq")!;
  const before = oldest.style.getPropertyValue("--asq-y");
  const wheel = new WheelEvent("wheel", { deltaY: -200, cancelable: true });
  strip.dispatchEvent(wheel);
  await nextFrame();
  expect([strip.dataset.scrollable, wheel.defaultPrevented, oldest.style.getPropertyValue("--asq-y") === before])
    .toMatchInlineSnapshot(`[
  "false",
  false,
  true,
]`);
});

it("draws nothing while the pointer is inside, then the newest frame once", async () => {
  const { host, frames } = rig();
  frames.next(recentFrame(5));
  const strip = host.querySelector<HTMLElement>(".asq-host")!;
  strip.dispatchEvent(new PointerEvent("pointerenter"));
  frames.next(recentFrame(6));
  frames.next(recentFrame(7));
  expect(host.querySelectorAll(".asq")).toHaveLength(5);
  strip.dispatchEvent(new PointerEvent("pointerleave"));
  expect(host.querySelectorAll(".asq")).toHaveLength(7);
});

it("keeps the hold while either presence stays, and paints when both go", async () => {
  const { host, frames } = rig();
  frames.next(recentFrame(5));
  const strip = host.querySelector<HTMLElement>(".asq-host")!;
  strip.dispatchEvent(new PointerEvent("pointerenter"));
  strip.dispatchEvent(new FocusEvent("focusin"));
  frames.next(recentFrame(7));
  strip.dispatchEvent(new PointerEvent("pointerleave"));
  expect(host.querySelectorAll(".asq")).toHaveLength(5);
  strip.dispatchEvent(new FocusEvent("focusout"));
  expect(host.querySelectorAll(".asq")).toHaveLength(7);
});

it("keeps the wheel live during the hold, repainting the held frame", async () => {
  const { host, frames } = rig();
  frames.next(recentFrame(40));
  const strip = host.querySelector<HTMLElement>(".asq-host")!;
  const oldest = host.querySelector<HTMLElement>(".asq")!;
  const before = Number.parseFloat(oldest.style.getPropertyValue("--asq-y"));
  strip.dispatchEvent(new PointerEvent("pointerenter"));
  frames.next(recentFrame(40, 39));
  expect(host.querySelector<HTMLElement>('[data-turn="s1:40"]')?.dataset.active).toBe("false");
  strip.dispatchEvent(new WheelEvent("wheel", { deltaY: -200, cancelable: true }));
  await waitFor(() => host.querySelector<HTMLElement>('[data-turn="s1:40"]')?.dataset.active === "true");
  expect(Number.parseFloat(oldest.style.getPropertyValue("--asq-y")) - before).toBe(-200);
});
