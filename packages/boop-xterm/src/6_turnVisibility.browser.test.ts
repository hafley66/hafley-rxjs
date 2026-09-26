import { Signal, toSignal, type EndpointResponse } from "@hafley66/signals";
import { of, throwError, timer, map, type Observable } from "rxjs";
import { describe, expect, it, vi } from "vitest";
import type { BoopTurn, VisibleTurn } from "./0_types.js";
import { terminalInputRegion, type TurnSpan } from "./2_turnLocate.js";
import type { PaneRuntimeState } from "./3_ports.js";
import { paneSessionStream } from "./4_paneSession.js";
import { bufferRowAtPoint, viewportStream } from "./4_viewport.js";
import { regionAtBufferRow, turnAtBufferRow, turnVisibilityStream } from "./6_turnVisibility.js";
import { testPorts, type Script } from "./test/0_endpointTransport.js";
import { openRealTerminal, waitFor, writeTerminal } from "./test/1_realTerminal.js";

const said = "hello visible turn from the pane";
const source: BoopTurn = { session: "s1", harness: "omp", turn: 1, ts: 1, role: "assistant", said };
const second: BoopTurn = { ...source, turn: 2, said: "second visible turn from the pane" };
const binding = { session: "s1", harness: "omp" };

function span(turn: BoopTurn): TurnSpan {
  return { ...turn, id: `${turn.session}:${turn.turn}`, bufferStart: 0, bufferEnd: 0,
    anchorStart: 0, anchorEnd: 0, confidence: "anchored" };
}

function runtime() {
  return Signal<PaneRuntimeState>({ viewportRevision: 0,
    selection: { selection: null, captured: [], anchor: null, dragging: false } });
}

async function rig(script: Script, initial = said) {
  const { term, host } = openRealTerminal();
  await writeTerminal(term, initial);
  const ports = testPorts(script);
  const root = runtime();
  const identity = { id: "p", target: "tmux:1", socket: null };
  const viewport = viewportStream(term, root, ports);
  const session = paneSessionStream(identity, ports);
  const visibility = turnVisibilityStream(term, identity, viewport, session, root, ports);
  return { term, host, ports, root, viewport, session, visibility };
}

function response(url: string): Observable<EndpointResponse> {
  if (url === "boop_mux_session") return of({ status: 200, body: binding });
  if (url === "boop_mux_capture") return of({ status: 200, body: said });
  if (url === "boop_turns") return of({ status: 200, body: [source] });
  if (url === "boop_turns_recent") return of({ status: 200, body: [] });
  if (url === "boop_sync_session") return of({ status: 200, body: { written: 0, dropped: 0 } });
  return of({ status: 200, body: [] });
}

describe("turnVisibilityStream with a real Terminal", () => {
  it("composes sampled geometry with pure turn and region lookups", async () => {
    const { term } = openRealTerminal();
    await writeTerminal(term, said);
    const viewport = viewportStream(term, runtime(), testPorts((request) => response(request.url)));
    const geometry = viewport.snapshot.geometry.$();
    const row = bufferRowAtPoint(geometry, { clientX: 5, clientY: geometry.top + geometry.cellHeight / 2 });
    expect(row).toBe(geometry.viewportY);
    if (row === null) throw new Error("sampled point was outside the viewport");
    const region = { id: "r1", turnId: "s1:1", kind: "heading" as const,
      sourceStart: 0, sourceEnd: 0, text: said, bufferStart: row, bufferEnd: row };
    const visible: VisibleTurn[] = [{ ...span(source), bufferStart: row, bufferEnd: row,
      anchorStart: row, anchorEnd: row, regions: [region], source: "xterm+boop" }];
    expect(turnAtBufferRow(visible, row)?.id).toBe("s1:1");
    expect(regionAtBufferRow(visible, row)?.id).toBe("r1");
    expect(turnAtBufferRow(visible, null)).toBeNull();
  });

  it("stale scan drops the first locator result after a viewport revision", async () => {
    const calls: string[] = [];
    const { term, visibility } = await rig((request) => {
      if (request.url === "boop_turns") return of({ status: 200, body: [source, second] });
      if (request.url === "boop_locate_turns") {
        const body = request.body as { lines: Array<{ text: string }> };
        const text = body.lines[0]?.text ?? "";
        calls.push(text);
        return timer(text === said ? 250 : 20).pipe(map(() => ({ status: 200,
          body: [span(text === said ? source : second)] })));
      }
      return response(request.url);
    });
    const seen: string[][] = [];
    const settled: number[] = [];
    const subscription = visibility.state.visible.$.subscribe((turns) => seen.push(turns.map((turn) => turn.id)));
    const done = visibility.settled.$.subscribe(() => settled.push(performance.now()));
    await waitFor(() => calls.length >= 1);
    await writeTerminal(term, `\r\x1b[2K${second.said}`);
    await waitFor(() => seen.some((ids) => ids.includes("s1:2")));
    expect(calls).toEqual([said, second.said]);
    expect(seen.filter((ids) => ids.length)).toEqual([["s1:2"]]);
    expect(settled.length).toBe(2);
    done.unsubscribe();
    subscription.unsubscribe();
  });

  it("in-flight activity coalesces burst triggers into one trailing scan", async () => {
    const calls: number[] = [];
    const { term, visibility } = await rig((request) => {
      if (request.url === "boop_locate_turns") {
        calls.push(performance.now());
        return timer(calls.length === 1 ? 300 : 20).pipe(map(() => ({ status: 200, body: [span(source)] })));
      }
      return response(request.url);
    });
    const subscription = visibility.state.$.subscribe();
    await waitFor(() => calls.length === 1);
    const writes = ["first update", "second update", "third update"].map((value) =>
      writeTerminal(term, `\r\x1b[2K${value}`));
    await Promise.all(writes);
    await waitFor(() => calls.length === 2);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(calls).toHaveLength(2);
    subscription.unsubscribe();
  });

  it("locator error uses the pure fallback and retains composer trim", async () => {
    const calls: string[] = [];
    const screen = `${said}\r\n› composer\r\nstatus · Context`;
    const { ports, viewport, visibility } = await rig((request) => {
      calls.push(request.url);
      if (request.url === "boop_locate_turns") return throwError(() => new Error("locator"));
      if (request.url === "boop_mux_capture") return of({ status: 200, body: screen.replaceAll("\r", "") });
      return response(request.url);
    }, screen);
    toSignal(ports.harness).$("codex");
    expect(viewport.snapshot.lines.$().slice(0, 3).map((line) => line.text)).toEqual([said, "› composer", "status · Context"]);
    expect(terminalInputRegion("codex", viewport.snapshot.lines.$())).toEqual({ start: 1, end: 2 });
    const subscription = visibility.state.$.subscribe();
    await waitFor(() => visibility.state.visible.$().length > 0);
    expect(calls).toContain("boop_locate_turns");
    expect(visibility.state.visible.$().map((turn) => ({ id: turn.id, bufferEnd: turn.bufferEnd })))
      .toEqual([{ id: "s1:1", bufferEnd: 0 }]);
    subscription.unsubscribe();
  });

  it("capture polling ends when the five-second activity lease expires", async () => {
    const captures: number[] = [];
    const { term, visibility } = await rig((request) => {
      if (request.url === "boop_mux_capture") captures.push(performance.now());
      return response(request.url);
    });
    const subscription = visibility.state.$.subscribe();
    await waitFor(() => captures.length >= 1);
    await writeTerminal(term, " after activity");
    await waitFor(() => captures.length >= 3, 3_500);
    await new Promise((resolve) => setTimeout(resolve, 5_300));
    const count = captures.length;
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    expect(captures.length).toBe(count);
    expect(count).toBeGreaterThanOrEqual(5);
    subscription.unsubscribe();
  });

  it("skips scans while the pane is hidden and scans when it becomes visible", async () => {
    const scans: string[] = [];
    const { term, ports, visibility } = await rig((request) => {
      if (request.url === "boop_locate_turns") {
        scans.push(request.url);
        return of({ status: 200, body: [span(source)] });
      }
      return response(request.url);
    });
    toSignal(ports.paneVisible).$(false);
    const subscription = visibility.effects.subscribe();
    vi.useFakeTimers();
    try {
      const writing = writeTerminal(term, "\r\x1b[2Khidden output");
      await vi.advanceTimersByTimeAsync(1_200);
      await writing;
      const hidden = scans.length;
      toSignal(ports.paneVisible).$(true);
      await vi.advanceTimersByTimeAsync(1_000);
      expect({ hidden, rescannedAfterShow: scans.length > hidden }).toMatchInlineSnapshot(`
        {
          "hidden": 0,
          "rescannedAfterShow": true,
        }
      `);
    } finally {
      subscription.unsubscribe();
      vi.useRealTimers();
    }
  });

  it("polls capture through continuous output before the write debounce settles", async () => {
    const captures: number[] = [];
    const syncs: number[] = [];
    const { term, visibility } = await rig((request) => {
      if (request.url === "boop_mux_capture") captures.push(performance.now());
      if (request.url === "boop_sync_session") syncs.push(performance.now());
      return response(request.url);
    });
    const subscription = visibility.effects.subscribe();
    vi.useFakeTimers();
    try {
      const writing = setInterval(() => term.write("."), 100);
      await vi.advanceTimersByTimeAsync(3_000);
      const whileWriting = captures.length;
      const syncsWhileWriting = syncs.length;
      clearInterval(writing);
      await vi.advanceTimersByTimeAsync(120);
      const afterWriteDebounce = captures.length;
      await vi.advanceTimersByTimeAsync(4_880);
      const afterLease = captures.length;
      await vi.advanceTimersByTimeAsync(5_000);
      const afterQuiet = captures.length;
      expect({ whileWriting, syncsWhileWriting, afterWriteDebounce, afterLease, afterQuiet }).toMatchInlineSnapshot(`
        {
          "afterLease": 8,
          "afterQuiet": 8,
          "afterWriteDebounce": 4,
          "syncsWhileWriting": 0,
          "whileWriting": 3,
        }
      `);
    } finally {
      subscription.unsubscribe();
      vi.useRealTimers();
    }
  });

  it("emits when the same turn id changes role at a fixed pointer row", async () => {
    let role: BoopTurn["role"] = "user";
    let now = Date.now();
    const clock = vi.spyOn(Date, "now").mockImplementation(() => now);
    const turnRequests: string[] = [];
    const locatedRoles: string[] = [];
    const { ports, viewport, visibility } = await rig((request) => {
      if (request.url === "boop_turns") {
        turnRequests.push(role);
        return of({ status: 200, body: [{ ...source, role }] });
      }
      if (request.url === "boop_locate_turns") {
        const turns = (request.body as { turns: BoopTurn[] }).turns;
        locatedRoles.push(turns[0].role);
        return of({ status: 200, body: [span(turns[0])] });
      }
      return response(request.url);
    });
    const geometry = viewport.snapshot.geometry.$();
    const row = bufferRowAtPoint(geometry, { clientX: 5, clientY: geometry.top + geometry.cellHeight / 2 });
    if (row === null) throw new Error("sampled point was outside the viewport");
    const events: Array<{ role: string; entered: number; exited: number; pointerId: string | null }> = [];
    const changes = visibility.changes.$.subscribe((event) => {
      if (!event) return;
      events.push({
        role: event.visible[0]?.role ?? "",
        entered: event.entered.length,
        exited: event.exited.length,
        pointerId: turnAtBufferRow(event.visible, row)?.id ?? null,
      });
    });
    const subscription = visibility.state.$.subscribe();
    await waitFor(() => events.length === 1);
    try {
      role = "assistant";
      now += 1_001;
      const beforeScans = locatedRoles.length;
      toSignal(ports.scanRequested).$(undefined);
      await waitFor(() => locatedRoles.length > beforeScans);
      expect({ events, turnRequests }).toMatchInlineSnapshot(`
        {
          "events": [
            {
              "entered": 1,
              "exited": 0,
              "pointerId": "s1:1",
              "role": "user",
            },
            {
              "entered": 0,
              "exited": 0,
              "pointerId": "s1:1",
              "role": "assistant",
            },
          ],
          "turnRequests": [
            "user",
            "assistant",
          ],
        }
      `);
    } finally {
      subscription.unsubscribe();
      changes.unsubscribe();
      clock.mockRestore();
    }
  });

  it("sync changes refetch capture only after nonzero written or dropped count", async () => {
    const captures: number[] = [];
    const syncs: number[] = [];
    const { term, visibility } = await rig((request) => {
      if (request.url === "boop_mux_capture") captures.push(performance.now());
      if (request.url === "boop_sync_session") {
        syncs.push(performance.now());
        return of({ status: 200, body: { written: syncs.length === 1 ? 0 : 1, dropped: 0 } });
      }
      return response(request.url);
    });
    const subscription = visibility.effects.subscribe();
    await writeTerminal(term, " first change");
    await waitFor(() => syncs.length === 1);
    const firstCaptures = captures.length;
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(captures.length).toBe(firstCaptures);
    await writeTerminal(term, " second change");
    await waitFor(() => syncs.length === 2);
    await waitFor(() => captures.length > firstCaptures);
    subscription.unsubscribe();
  });
});
