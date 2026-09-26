import { Signal, toSignal, type EndpointResponse } from "@hafley66/signals";
import { of, throwError, type Observable } from "rxjs";
import { TestScheduler } from "rxjs/testing";
import { describe, expect, it } from "vitest";
import type { BoopTurn, VisibleTurn } from "./0_types.js";
import type { TurnSpan } from "./2_turnLocate.js";
import type { PaneRuntimeState } from "./3_ports.js";
import { paneSessionStream } from "./4_paneSession.js";
import { bufferRowAtPoint, viewportStream } from "./4_viewport.js";
import { regionAtBufferRow, turnAtBufferRow, turnVisibilityStream } from "./6_turnVisibility.js";
import { testPorts, type Script } from "./test/0_endpointTransport.js";
import { testTerminal } from "./test/1_terminal.js";

const said = "hello visible turn from the pane";
const source: BoopTurn = { session: "s1", harness: "omp", turn: 1, ts: 1, role: "assistant", said };
const binding = { session: "s1", harness: "omp" };
const second: BoopTurn = { ...source, turn: 2, said: "second visible turn from the pane" };

function span(turn: BoopTurn): TurnSpan {
  return { ...turn, id: `${turn.session}:${turn.turn}`, bufferStart: 0, bufferEnd: 0,
    anchorStart: 0, anchorEnd: 0, confidence: "anchored" };
}

function runtime() {
  return Signal<PaneRuntimeState>({ viewportRevision: 0, selection: { selection: null, captured: [], anchor: null, dragging: false } });
}

function rig(script: Script) {
  const terminal = testTerminal([said]);
  const ports = testPorts(script);
  const root = runtime();
  const identity = { id: "p", target: "tmux:1", socket: null };
  const viewport = viewportStream(terminal.term, root, ports);
  const session = paneSessionStream(identity, ports);
  const visibility = turnVisibilityStream(terminal.term, identity, viewport, session, root, ports);
  return { terminal, ports, root, viewport, session, visibility };
}

function response(url: string): Observable<EndpointResponse> {
  if (url === "boop_mux_session") return of({ status: 200, body: binding });
  if (url === "boop_mux_capture") return of({ status: 200, body: said });
  if (url === "boop_turns") return of({ status: 200, body: [source] });
  if (url === "boop_turns_recent") return of({ status: 200, body: [] });
  if (url === "boop_sync_session") return of({ status: 200, body: { written: 0, dropped: 0 } });
  return of({ status: 200, body: [] });
}

describe("turnVisibilityStream", () => {
  it("composes sampled geometry with pure turn and region lookups", () => {
    const region = { id: "r1", turnId: "s1:1", kind: "heading" as const,
      sourceStart: 0, sourceEnd: 0, text: said, bufferStart: 42, bufferEnd: 42 };
    const visible: VisibleTurn[] = [{ ...span(source), bufferStart: 42, bufferEnd: 42,
      anchorStart: 42, anchorEnd: 42, regions: [region], source: "xterm+boop" }];
    const row = bufferRowAtPoint({ top: 100, cellHeight: 10, viewportY: 40, rows: 20 }, { clientX: 5, clientY: 125 });
    expect(row).toBe(42);
    expect(turnAtBufferRow(visible, row)?.id).toBe("s1:1");
    expect(regionAtBufferRow(visible, row)?.id).toBe("r1");
    expect(turnAtBufferRow(visible, null)).toBeNull();
  });

  it("stale scan drops the first locator result after a viewport revision", () => {
    const scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
    scheduler.run(({ cold }) => {
      const calls: Array<{ frame: number; text: string }> = [];
      const { terminal, visibility } = rig((request) => {
        if (request.url === "boop_turns") return of({ status: 200, body: [source, second] });
        if (request.url === "boop_locate_turns") {
          const body = request.body as { lines: Array<{ text: string }> };
          const text = body.lines[0]?.text ?? "";
          calls.push({ frame: scheduler.frame, text });
          return text === said
            ? cold("----a|", { a: { status: 200, body: [span(source)] } })
            : cold("--b|", { b: { status: 200, body: [span(second)] } });
        }
        return response(request.url);
      });
      const seen: Array<{ frame: number; ids: string[] }> = [];
      const settled: number[] = [];
      const subscription = visibility.state.visible.$.subscribe((turns) => seen.push({ frame: scheduler.frame, ids: turns.map((turn) => turn.id) }));
      const done = visibility.settled.$.subscribe(() => settled.push(scheduler.frame));
      scheduler.schedule(() => { terminal.setLines([second.said]); terminal.fire("scroll"); }, 2);
      scheduler.schedule(() => { subscription.unsubscribe(); done.unsubscribe(); }, 12);
      scheduler.flush();
      expect(calls).toEqual([{ frame: 0, text: said }, { frame: 4, text: second.said }]);
      expect(seen.filter((entry) => entry.ids.length).map((entry) => entry.ids)).toEqual([["s1:2"]]);
      expect(settled).toEqual([4, 6]);
    });
  });

  it("in-flight activity coalesces burst triggers into one trailing scan", () => {
    const scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
    scheduler.run(({ cold }) => {
      const calls: number[] = [];
      const { terminal, visibility } = rig((request) => {
        if (request.url === "boop_locate_turns") {
          calls.push(scheduler.frame);
          return cold("----a|", { a: { status: 200, body: [span(source)] } });
        }
        return response(request.url);
      });
      const subscription = visibility.state.$.subscribe();
      scheduler.schedule(() => { terminal.setLines(["first update"]); terminal.fire("scroll"); }, 1);
      scheduler.schedule(() => { terminal.setLines(["second update"]); terminal.fire("scroll"); }, 2);
      scheduler.schedule(() => { terminal.setLines(["third update"]); terminal.fire("scroll"); }, 3);
      scheduler.schedule(() => subscription.unsubscribe(), 12);
      scheduler.flush();
      expect(calls).toEqual([0, 4]);
    });
  });

  it("locator error uses the pure fallback and retains composer trim", () => {
    const scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
    scheduler.run(() => {
      const calls: string[] = [];
      const { terminal, ports, visibility } = rig((request) => {
        calls.push(request.url);
        if (request.url === "boop_locate_turns") return throwError(() => new Error("locator"));
        if (request.url === "boop_mux_capture") return of({ status: 200, body: `${said}\n› composer\n · Context` });
        return response(request.url);
      });
      terminal.setLines([said, "› composer", " · Context"]);
      toSignal(ports.harness).$("codex");
      const visible: Array<Array<{ id: string; bufferEnd: number }>> = [];
      const subscription = visibility.state.visible.$.subscribe((turns) => visible.push(turns.map((turn) => ({ id: turn.id, bufferEnd: turn.bufferEnd }))));
      scheduler.schedule(() => subscription.unsubscribe(), 10);
      scheduler.flush();
      expect(calls).toContain("boop_locate_turns");
      expect(visible.at(-1)).toEqual([{ id: "s1:1", bufferEnd: 0 }]);
    });
  });

  it("capture polling ends when the five-second activity lease expires", () => {
    const scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
    scheduler.run(() => {
      const captures: number[] = [];
      const { terminal, visibility } = rig((request) => {
        if (request.url === "boop_mux_capture") captures.push(scheduler.frame);
        return response(request.url);
      });
      const subscription = visibility.state.$.subscribe();
      scheduler.schedule(() => terminal.fire("scroll"), 2);
      scheduler.schedule(() => subscription.unsubscribe(), 6_500);
      scheduler.flush();
      expect(captures[0]).toBe(0);
      expect(captures).toContain(1_002);
      expect(captures.every((frame) => frame <= 5_002)).toBe(true);
      expect(captures.length).toBeGreaterThanOrEqual(5);
    });
  });

  it("sync changes refetch capture only after nonzero written or dropped count", () => {
    const scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
    scheduler.run(() => {
      const captures: number[] = [];
      const syncs: number[] = [];
      const { terminal, visibility } = rig((request) => {
        if (request.url === "boop_mux_capture") captures.push(scheduler.frame);
        if (request.url === "boop_sync_session") {
          syncs.push(scheduler.frame);
          return of({ status: 200, body: { written: syncs.length === 1 ? 0 : 1, dropped: 0 } });
        }
        return response(request.url);
      });
      const subscription = visibility.effects.subscribe();
      scheduler.schedule(() => terminal.fire("scroll"), 2);
      scheduler.schedule(() => terminal.fire("scroll"), 200);
      scheduler.schedule(() => subscription.unsubscribe(), 350);
      scheduler.flush();
      expect(syncs).toEqual([122, 320]);
      expect(captures.filter((frame) => frame === 122)).toEqual([]);
      expect(captures).toContain(320);
    });
  });
});
