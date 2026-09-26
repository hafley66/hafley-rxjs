import { describe, expect, it } from "vitest";
import type { VisibleTerminalLine } from "./3_ports.js";
import type { TerminalRowGeometry } from "./1_rowGeometry.js";
import type { VisibleTurn } from "./0_types.js";
import type { BoopTurnComment, BoopTurnCommentFork } from "./2_contextSyncPure.js";
import { placeAnnotations, type PlacedAnnotation } from "./3_turnMarksPure.js";
import { placeForks, type PlacedFork } from "./4_forkMarks.js";
import { forkAge, forkBodyLines, forkCommand, forkHeaderText, forkedLane, selectionClientId, FORK_PRESETS, forkShape, forkKey, forkMenuTargets, fork_indent_px, fork_pane_rows, placeForkOverlays, placeForkPanes, tailLines } from "./5_forkRenderPure.js";

const line = (id: string, row: number, text: string): VisibleTerminalLine =>
  ({ id, bufferStart: row, bufferEnd: row, viewportStart: row, viewportEnd: row, text });

const turn = (id: string, start: number, end: number): VisibleTurn => ({
  id, bufferStart: start, bufferEnd: end, anchorStart: start, anchorEnd: end,
  regions: [], confidence: "anchored", source: "xterm+boop",
  session: id.slice(0, id.lastIndexOf(":")), harness: "omp", turn: Number(id.slice(id.lastIndexOf(":") + 1)), ts: 0, role: "assistant", said: "" });

const comment = (over: Partial<BoopTurnComment> = {}): BoopTurnComment => ({
  commentId: 26,
  clientId: "selection:26:0",
  kind: "selection",
  quote: "DBSP.State.Retain",
  note: "bad name",
  enabled: true,
  tabName: "sprefa-2",
  targets: [{ session: "sess-a", turn: 3080, role: "assistant", replyTurn: 3083 }],
  createdTs: 0,
  updatedTs: 0,
  ...over,
});

const fork = (over: Partial<BoopTurnCommentFork> = {}): BoopTurnCommentFork => ({
  commentId: 26,
  lane: "fork-comment-26",
  branch: "fork/comment-26",
  brief: "~/agents/mail/forks/comment-26.md",
  createdTs: FORKED_AT,
  state: "done",
  rc: 0,
  reply: { session: "fork-comment-26", turn: 40, said: "moved the budget into deliver_hail_budgeted" },
  tmux: "fork-comment-26",
  ...over,
});

const FORKED_AT = 1_700_000_000_000;

const lines = [
  line("l1", 20, "  - DBSP.State.Integrate"),
  line("l2", 21, "  - DBSP.State.Retain"),
  line("l3", 22, "  - DBSP.Event.Arrival"),
];

const geometry: TerminalRowGeometry = {
  viewportY: 18,
  rows: 24,
  cellHeight: 20,
  top: 0,
  left: 60,
  right: 8,
  screen: { top: 0, bottom: 480, left: 60, right: 800, height: 480 },
};

const placedAnnotations = (over: Partial<BoopTurnComment> = {}): PlacedAnnotation[] =>
  placeAnnotations([comment(over)], [turn("sess-a:3080", 20, 22)], lines);

const placed = (forks: BoopTurnCommentFork[]): PlacedFork[] =>
  placeForks(placedAnnotations(), forks);

describe("the shape switch", () => {
  it("reads the boolean: false is the overlay, true is the child pane", () => {
    expect(forkShape(false)).toBe("overlay");
    expect(forkShape(true)).toBe("pane");
  });
});

describe("header and body", () => {
  it("names the lane, preset, state, rc and age, with the disclosure arrow", () => {
    expect(forkHeaderText(fork(), false, FORKED_AT + 72_000))
      .toBe("▸ fork-comment-26  flash4  done rc=0  1m12s");
    expect(forkHeaderText(fork(), true, FORKED_AT + 72_000).startsWith("▾")).toBe(true);
  });

  it("drops rc and keeps the age while a lane is running", () => {
    expect(forkHeaderText(fork({ state: "running", rc: null, reply: null }), false, FORKED_AT + 12_000))
      .toBe("▸ fork-comment-26  flash4  running  12s");
  });

  it("formats an age in seconds, minutes and hours", () => {
    expect(forkAge(FORKED_AT, FORKED_AT + 9_000)).toBe("9s");
    expect(forkAge(FORKED_AT, FORKED_AT + 72_000)).toBe("1m12s");
    expect(forkAge(FORKED_AT, FORKED_AT + 7_440_000)).toBe("2h04m");
  });

  it("reads a lane whose row carries seconds, not milliseconds", () => {
    expect(forkAge(FORKED_AT / 1000, FORKED_AT + 9_000)).toBe("9s");
    expect(forkAge(0, FORKED_AT)).toBe("");
  });

  it("wraps the reply and closes on the branch and brief", () => {
    const body = forkBodyLines(fork(), 30);
    expect(body[0].startsWith("│ ")).toBe(true);
    expect(body[body.length - 1]).toBe("└ fork/comment-26  ~/agents/mail/forks/comment-26.md");
  });

  it("has only the branch line while a lane has not replied", () => {
    expect(forkBodyLines(fork({ state: "running", rc: null, reply: null }), 30))
      .toEqual(["└ fork/comment-26  ~/agents/mail/forks/comment-26.md"]);
  });
});

describe("placement", () => {
  it("puts an overlay on the mark row plus one, spanning the grid", () => {
    const [box] = placeForkOverlays(geometry, placed([fork()]));
    expect(box).toMatchObject({ key: "26:fork-comment-26", bufferRow: 22, top: 80, left: 60, right: 8, onScreen: true });
  });

  it("indents a pane and gives it a fixed height in rows", () => {
    const [box] = placeForkPanes(geometry, placed([fork()]));
    expect(box).toMatchObject({ top: 80, left: 60 + fork_indent_px, height: fork_pane_rows * 20, spacer: 0 });
  });

  it("stacks two panes on one row: the second starts where the first ends", () => {
    const panes = placeForkPanes(geometry, placed([fork(), fork({ lane: "fork-comment-26-retry" })]));
    expect(panes.map((pane) => pane.top)).toEqual([80, 80 + fork_pane_rows * 20]);
    expect(panes[1].spacer).toBe(fork_pane_rows * 20);
  });

  it("leaves a pane far below its neighbour on its own row", () => {
    const near = placed([fork()])[0];
    const far: PlacedFork = { ...near, bufferRow: 60, fork: fork({ lane: "fork-comment-26-retry" }) };
    const panes = placeForkPanes(geometry, [near, far]);
    expect(panes.map((pane) => pane.spacer)).toEqual([0, 0]);
    expect(panes[1].top).toBe((61 - geometry.viewportY) * geometry.cellHeight);
  });

  it("hides an overlay whose row scrolled off the viewport", () => {
    const off = placeForkOverlays({ ...geometry, viewportY: 200 }, placed([fork()]));
    expect(off[0].onScreen).toBe(false);
  });
});

describe("the child pane's mirror", () => {
  it("keeps the last rows of a capture", () => {
    expect(tailLines("a\nb\nc\nd\n\n", 2)).toEqual(["c", "d"]);
    expect(tailLines("a", 4)).toEqual(["a"]);
  });
});

describe("the fork trigger", () => {
  it("spells the verb boop already has", () => {
    expect(forkCommand(26, "flash4")).toBe("boop beep fork 26 --preset flash4 --interactive");
  });

  it("offers the three presets the menu lists", () => {
    expect([...FORK_PRESETS]).toEqual(["flash4", "pro4", "opus"]);
  });

  it("keys a selection's comment row by what was selected, not by the clock", () => {
    const first = selectionClientId("sprefa-2", "DBSP.State.Retain", ["sess-a:3080"]);
    expect(first).toBe(selectionClientId("sprefa-2", "DBSP.State.Retain", ["sess-a:3080"]));
    expect(first).not.toBe(selectionClientId("sprefa-2", "DBSP.State.Integrate", ["sess-a:3080"]));
    expect(first).not.toBe(selectionClientId("other-tab", "DBSP.State.Retain", ["sess-a:3080"]));
    expect(first.startsWith("fork-selection:")).toBe(true);
  });

  it("names the lane the fork verb printed, and null when it printed none", () => {
    expect(forkedLane("brief /x.md\nforked comment 47 -> lane fork-comment-47\n")).toBe("fork-comment-47");
    expect(forkedLane("")).toBeNull();
    expect(forkedLane("Error: no git repo at /Users/x; pass --cwd <repo>")).toBeNull();
  });

  it("offers one target per stored comment, labelled by its note", () => {
    expect(forkMenuTargets(placedAnnotations())).toEqual([{ commentId: 26, label: "bad name" }]);
  });

  it("refuses a comment the store has never seen", () => {
    expect(forkMenuTargets(placedAnnotations({ commentId: 0 }))).toEqual([]);
  });
});
