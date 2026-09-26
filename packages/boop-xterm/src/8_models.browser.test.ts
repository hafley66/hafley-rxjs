import { Signal } from "@hafley66/signals";
import { EMPTY, merge, of, throwError, type Subscription } from "rxjs";
import { afterEach, describe, expect, it } from "vitest";
import type { VisibleTurn } from "./0_types.js";
import type { PromptContextItem } from "./1_contextQueuePure.js";
import type { GutterPaint, StructuredSelectable } from "./1_contextGutterPure.js";
import type { BoopTurnComment, BoopTurnCommentFork } from "./2_contextSyncPure.js";
import type { PlacedFork } from "./4_forkMarks.js";
import type { LineAnchorModel, LineAnchorState, TurnVisibilityModel } from "./3_ports.js";
import { gutterLeft, readRowGeometry } from "./1_rowGeometry.js";
import { contextQueueStream } from "./8a_contextQueue.js";
import { contextGutterStream } from "./8b_contextGutter.js";
import { contextSyncStream } from "./8c_contextSync.js";
import type { ContextSyncModel } from "./8c_contextSync.js";
import { hoverCheckStream } from "./8d_hoverCheck.js";
import { turnMarksStream } from "./8e_turnMarks.js";
import { forkRenderStream } from "./8f_forkRender.js";
import { testPorts, type Script } from "./test/0_endpointTransport.js";
import { nextFrame, openRealTerminal, waitFor, writeTerminal } from "./test/1_realTerminal.js";

const connected: Subscription[] = [];
afterEach(() => { for (const subscription of connected.splice(0)) subscription.unsubscribe(); });

function turn(row = 1): VisibleTurn {
  return { id: "sess-a:3", session: "sess-a", harness: "omp", turn: 3, ts: 0, role: "assistant", said: "quoted line",
    bufferStart: row, bufferEnd: row, anchorStart: row, anchorEnd: row, regions: [], confidence: "anchored", source: "xterm+boop" };
}
function projection() {
  const visibility: TurnVisibilityModel = {
    state: Signal({ visible: [] as VisibleTurn[] }), scanning: Signal(false), changes: Signal(), settled: Signal(), effects: EMPTY,
  };
  const anchors: LineAnchorModel = {
    state: Signal<LineAnchorState>({ visible: [], settled: true, elementsByBufferRow: new Map() }), events: Signal(), effects: EMPTY,
  };
  return { visibility, anchors };
}
function item(over: Partial<PromptContextItem> = {}): PromptContextItem {
  return { id: "selection:1", kind: "selection", text: "quoted line", note: "first note", turnIds: ["sess-a:3"], enabled: true, ...over };
}
function scriptFor(calls: Array<{ url: string; body: unknown }>, failWrite = false): Script {
  return (request) => {
    calls.push({ url: request.url, body: request.body });
    if (request.url === "write_pty" && failWrite) return throwError(() => new Error("pty closed"));
    if (request.url === "boop_turn_comments" || request.url === "boop_turn_annotations" || request.url === "boop_turn_comment_forks")
      return of({ status: 200, body: [] });
    if (request.url === "boop_turn_comment_upsert") return of({ status: 200, body: 47 });
    return of({ status: 200, body: null });
  };
}
function queueFixture(script: Script = scriptFor([])) {
  const { term, host } = openRealTerminal();
  const { visibility, anchors } = projection();
  const ports = testPorts(script);
  const identity = { id: "pane-1", target: "tmux:1", socket: null, graphics: false };
  const queue = contextQueueStream(term, host, visibility, anchors, identity, ports);
  connected.push(queue.effects.subscribe());
  return { term, host, visibility, anchors, ports, queue };
}

describe("context queue real terminal", () => {
  it("keeps the annotation caret and selected characters when stored rows hydrate", async () => {
    const { host, queue } = queueFixture();
    queue.add.$(item());
    const note = host.querySelector<HTMLTextAreaElement>(".term-context-queue textarea")!;
    note.focus(); note.setSelectionRange(2, 6);
    queue.hydrate.$([item({ note: "stored older" }), item({ id: "selection:2", text: "second" })]);
    const after = host.querySelector<HTMLTextAreaElement>('[data-context-id="selection:1"] textarea')!;
    expect([after.value, after.selectionStart, after.selectionEnd, host.querySelectorAll(".term-context-queue-item").length])
      .toMatchInlineSnapshot(`[
  "first note",
  2,
  6,
  2,
]`);
  });

  it("does not overwrite a retained quote when delete and add happen in the same millisecond", () => {
    const { queue } = queueFixture();
    queue.add.$(item());
    queue.remove.$("selection:1");
    queue.add.$(item({ text: "new quote" }));
    queue.hydrate.$([item({ text: "old stored quote" })]);
    expect(queue.state.items.$().map((row) => [row.id, row.text])).toMatchInlineSnapshot(`[
  [
    "selection:1",
    "new quote",
  ],
]`);
  });

  it("sends bracketed paste after copy mode exit and retains rows on write failure", async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const { host, queue } = queueFixture(scriptFor(calls, true));
    queue.add.$(item());
    host.querySelector<HTMLButtonElement>("[data-context-send]")!.click();
    await waitFor(() => queue.state.sendError.$() !== null);
    expect([calls.filter((call) => ["boop_mux_exit_copy_mode", "write_pty"].includes(call.url)).map((call) => call.url),
      queue.state.items.$().length, queue.state.sendError.$()]).toMatchInlineSnapshot(`[
  [
    "boop_mux_exit_copy_mode",
    "write_pty",
  ],
  1,
  "pty closed",
]`);
  });
});

describe("context sync endpoint order", () => {
  it("writes the final note before stamping the row sent, ahead of the debounce", async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const { host, queue, ports, visibility } = queueFixture(scriptFor(calls));
    const sync = contextSyncStream(queue, ports.tabName, ports.sessionIds, Signal<VisibleTurn[]>(visibility.state.visible.$()), ports);
    connected.push(sync.effects.subscribe());
    queue.add.$(item({ note: "typed fast" }));
    host.querySelector<HTMLButtonElement>("[data-context-send]")!.click();
    await waitFor(() => calls.some((call) => call.url === "boop_turn_comments_sent"));
    await new Promise((resolve) => setTimeout(resolve, 350));
    const writes = calls.filter((call) => ["boop_turn_comment_upsert", "boop_turn_comments_sent", "boop_turn_comment_delete"].includes(call.url));
    expect(writes.map((call) => call.url)).toMatchInlineSnapshot(`[
  "boop_turn_comment_upsert",
  "boop_turn_comments_sent",
]`);
    expect((writes[0].body as { comment: BoopTurnComment }).comment.note).toBe("typed fast");
  });

  it("stores the slice as an already-sent comment and hands back its id", async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const { queue, ports, visibility } = queueFixture(scriptFor(calls));
    const sync = contextSyncStream(queue, ports.tabName, ports.sessionIds, Signal<VisibleTurn[]>(visibility.state.visible.$()), ports);
    const written: Array<{ clientId: string; commentId: number | null }> = [];
    connected.push(merge(sync.effects, sync.selectionWritten.$).subscribe((value) => {
      if (value && typeof value === "object" && "clientId" in value) written.push(value);
    }));
    sync.sendSelection.$(item({ id: "fork-selection:9zk" }));
    await waitFor(() => written.length > 0);
    expect([written, calls.filter((call) => ["boop_turn_comment_upsert", "boop_turn_comments_sent"].includes(call.url)).map((call) => call.url)])
      .toMatchInlineSnapshot(`[
  [
    {
      "clientId": "fork-selection:9zk",
      "commentId": 47,
    },
  ],
  [
    "boop_turn_comment_upsert",
    "boop_turn_comments_sent",
  ],
]`);
  });
});

function fork(over: Partial<BoopTurnCommentFork> = {}): BoopTurnCommentFork {
  return { commentId: 26, lane: "fork-comment-26", branch: "fork/comment-26", brief: "brief.md", createdTs: 0,
    state: "done", rc: 0, reply: { session: "fork-comment-26", turn: 4, said: "reply body" }, tmux: "fork-comment-26", ...over };
}
function placedFork(over: Partial<BoopTurnCommentFork> = {}): PlacedFork {
  const comment: BoopTurnComment = { commentId: 26, clientId: "selection:26", kind: "selection", quote: "quoted line",
    note: "note", enabled: true, tabName: "test", targets: [{ session: "sess-a", turn: 3, role: "assistant" }], createdTs: 0, updatedTs: 0 };
  return { comment, turn: turn(1), bufferRow: 1, fork: fork(over) };
}
function forkFixture(livePane: boolean, script: Script = scriptFor([])) {
  const { term, host } = openRealTerminal();
  const gutterElement = document.createElement("div");
  gutterElement.className = "term-context-gutter";
  host.append(gutterElement);
  const paint = Signal<GutterPaint | undefined>(undefined);
  const placedForks = Signal<PlacedFork[]>([]);
  const ports = testPorts(script);
  const live = Signal(livePane);
  const model = forkRenderStream(term, host, { paint, selectables: Signal<ReadonlyMap<string, StructuredSelectable>>(new Map()), effects: EMPTY },
    { placedForks, menuRequested: Signal(), effects: EMPTY }, live, ports);
  connected.push(model.effects.subscribe());
  return { term, host, paint, placedForks, live };
}
async function paintFork(fixture: ReturnType<typeof forkFixture>, forks: PlacedFork[]) {
  await writeTerminal(fixture.term, "quoted line\r\n");
  const geometry = readRowGeometry(fixture.term, fixture.host)!;
  fixture.placedForks.$(forks.map((entry) => ({ ...entry, bufferRow: geometry.viewportY + 1 })));
  fixture.paint.$({ geometry, turns: [turn(geometry.viewportY + 1)], lines: [] });
  await nextFrame();
}

describe("fork render on real xterm", () => {
  it("paints one collapsed overlay per fork, headers only", async () => {
    const fixture = forkFixture(false);
    await paintFork(fixture, [placedFork()]);
    const node = fixture.host.querySelector<HTMLElement>(".term-fork")!;
    expect([node.dataset.shape, node.querySelector<HTMLElement>(".term-fork-body")!.hidden]).toMatchInlineSnapshot(`[
  "overlay",
  true,
]`);
  });

  it("expands on a click and collapses on the next one", async () => {
    const fixture = forkFixture(false);
    await paintFork(fixture, [placedFork()]);
    const header = fixture.host.querySelector<HTMLButtonElement>(".term-fork-header")!;
    header.click();
    expect(fixture.host.querySelector<HTMLElement>(".term-fork-body")!.textContent).toContain("reply body");
    header.click();
    expect(fixture.host.querySelector<HTMLElement>(".term-fork-body")!.hidden).toBe(true);
  });

  it("switches to a child pane bound to the lane's tmux target", async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const fixture = forkFixture(true, scriptFor(calls));
    await paintFork(fixture, [placedFork()]);
    await waitFor(() => calls.some((call) => call.url === "boop_mux_capture"));
    const node = fixture.host.querySelector<HTMLElement>(".term-fork")!;
    expect([node.dataset.shape, node.querySelector<HTMLElement>(".term-fork-header")!.textContent,
      calls.find((call) => call.url === "boop_mux_capture")?.body]).toMatchInlineSnapshot(`[
  "pane",
  "tmux fork-comment-26 · flash4 · done",
  {
    "socket": null,
    "target": "fork-comment-26",
  },
]`);
  });

  it("never captures in the overlay shape", async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const fixture = forkFixture(false, scriptFor(calls));
    await paintFork(fixture, [placedFork()]);
    expect(calls.filter((call) => call.url === "boop_mux_capture")).toHaveLength(0);
  });

  it("drops the element of a fork that left the screen", async () => {
    const fixture = forkFixture(false);
    await paintFork(fixture, [placedFork()]);
    fixture.placedForks.$([]);
    expect(fixture.host.querySelectorAll(".term-fork")).toHaveLength(0);
  });

  it("keys elements by comment and lane", async () => {
    const fixture = forkFixture(false);
    await paintFork(fixture, [placedFork()]);
    expect(fixture.host.querySelector<HTMLElement>(".term-fork")?.dataset.forkKey).toBe("26:fork-comment-26");
  });
});

it("stacks annotation marks and two fork lanes on a structured row without a hover duplicate", async () => {
  const { term, host, queue, visibility, anchors, ports } = queueFixture();
  host.style.setProperty("--boop-xterm-gutter-offset", "51px");
  await writeTerminal(term, "| A | B |\r\n");
  const geometry = readRowGeometry(term, host)!;
  const row = geometry.viewportY;
  const visible = { ...turn(row), regions: [{ id: "r1", turnId: "sess-a:3", kind: "table" as const,
    sourceStart: 0, sourceEnd: 0, text: "| A | B |", bufferStart: row, bufferEnd: row }] };
  visibility.state.$({ visible: [visible] });
  anchors.state.$({ visible: [{ id: "line-1", bufferStart: row, bufferEnd: row, viewportStart: 0,
    viewportEnd: 0, text: "| A | B |" }], settled: true, elementsByBufferRow: new Map() });
  const gutter = contextGutterStream(term, host, queue, visibility, anchors);
  const annotations = Signal<BoopTurnComment[]>([]);
  const forks = Signal<BoopTurnCommentFork[]>([]);
  const sync: ContextSyncModel = { annotations, forks, refresh: Signal(), flush: Signal(),
    sendSelection: Signal(), selectionWritten: Signal(), effects: EMPTY };
  const hover = hoverCheckStream(term, host, queue, gutter, anchors);
  const marks = turnMarksStream(host, queue, gutter, sync);
  const render = forkRenderStream(term, host, gutter, marks, ports.forkLivePane, ports);
  connected.push(merge(gutter.effects, hover.effects, marks.effects, render.effects).subscribe());
  const comment: BoopTurnComment = { commentId: 26, clientId: "a", kind: "table", quote: "| A | B |", note: "first",
    enabled: true, tabName: "test", targets: [{ session: "sess-a", turn: 3, role: "assistant" }], createdTs: 0, updatedTs: 0 };
  annotations.$([comment, { ...comment, commentId: 27, clientId: "b", note: "second" }]);
  forks.$([fork(), fork({ commentId: 27, lane: "fork-comment-27", tmux: "fork-comment-27" })]);
  await waitFor(() => host.querySelectorAll(".term-context-structured-check").length === 1
    && host.querySelectorAll(".term-fork").length === 2);
  host.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: geometry.screen.left + 20,
    clientY: geometry.screen.top + geometry.cellHeight / 2 }));
  expect([host.querySelectorAll(".term-context-structured-check").length,
    host.querySelector<HTMLElement>(".term-context-hover-check")?.hidden,
    host.querySelector<HTMLElement>(".term-context-mark")?.textContent,
    [...host.querySelectorAll<HTMLElement>(".term-fork")].map((node) => node.dataset.forkKey)])
    .toMatchInlineSnapshot(`[
  1,
  true,
  "✎2",
  [
    "26:fork-comment-26",
    "27:fork-comment-27",
  ],
]`);
  expect(host.querySelector<HTMLElement>(".term-context-structured-check")?.style.left)
    .toBe(`${gutterLeft(geometry, 51)}px`);
});
