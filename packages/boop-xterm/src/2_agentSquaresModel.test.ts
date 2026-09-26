import { describe, expect, it } from "vitest";
import { SQUARE_STEP } from "./0_agentSquareVisual.js";
import { boxMoved, previewOf, recentOffset, squaresOf, themedSquaresOf } from "./2_agentSquaresModel.js";
import type { SquareKind } from "./0_agentSquareVisual.js";
import type { Strip, StripLayout, StripTurn } from "./1_agentSquaresFeed.js";

const turn = (id: string, role: string, said: string, ts: number): StripTurn => ({
  session: "s1", harness: "claude", turn: Number(id.split(":")[1]), ts, role, said, id,
  bufferStart: 0, bufferEnd: 0, anchorStart: 0, anchorEnd: 0, confidence: "anchored",
});
const turns = [turn("s1:2", "assistant", "line one\nline two", 1_700_000_000_000),
  turn("s1:3", "tool", "sqlite3 --version", 1_700_000_100_000)];
const frame = (layout: StripLayout, pinned: StripTurn[] = [], carried: StripTurn[] = turns): Strip => ({
  session: "s1", at: 1_700_000_000_000, rows: 40, turns: carried, pinned, tags: {}, layout,
});
const recentFrame = (count: number): Strip => {
  const squares = Array.from({ length: count }, (_, index) => ({
    id: `s1:${index + 1}`, kind: "agent" as SquareKind, y: index, scale: 1, active: index === count - 1,
  }));
  return frame({ mode: "recent", rows: 40, squares }, [], squares.map((square, index) =>
    turn(square.id, "assistant", "a reply", 1_700_000_000_000 + index)));
};

describe("the strip's own numbers", () => {
  it("puts a relative square on its own row and the band in its own lane", () => {
    const props = squaresOf(frame({ mode: "relative", rows: 24, band: 1, squares: [
      { id: "s1:1", kind: "user", y: 0, scale: 1, active: false },
      { id: "s1:2", kind: "agent", y: 5, scale: 1.2, active: true },
      { id: "s1:3", kind: "tool", y: 9, scale: .9, active: false },
    ] }, [turn("s1:1", "user", "prompt", 1_699_999_000_000)]), { cellHeight: 17, track: 320 });
    expect({ active: props.active, band: props.band, track: props.track,
      squares: props.squares.map(({ id, y, pinned }) => ({ id, y, pinned })) }).toMatchInlineSnapshot(`
        {
          "active": 1,
          "band": 1,
          "squares": [
            {
              "id": "s1:1",
              "pinned": true,
              "y": 0,
            },
            {
              "id": "s1:2",
              "pinned": false,
              "y": 85,
            },
            {
              "id": "s1:3",
              "pinned": false,
              "y": 153,
            },
          ],
          "track": 408,
        }
      `);
  });
  it("centers the recent block independently of which squares are active", () => {
    const props = squaresOf(recentFrame(3), { cellHeight: 17, track: 320 });
    expect(props.squares.map((square) => square.y)).toEqual([160 - SQUARE_STEP, 160, 160 + SQUARE_STEP]);
    expect(props.band).toBe(0);
    expect(props.track).toBe(320);
    expect(squaresOf(recentFrame(40), { cellHeight: 17, track: 320 }).squares[0].y).toBe(0);
  });
  it("drops the wire type's map fields", () => {
    const layout = recentFrame(1).layout;
    expect(layout && "block" in layout || false).toBe(false);
    expect(layout && "span" in layout || false).toBe(false);
  });
  it("turns the store's escaped text back into words", () => {
    expect(previewOf("INFO \\u001b[2m2026-09-17T18:51:02Z\\u001b[0m\\nnext \\x1b[32mline\\u001b[0m done"))
      .toMatchInlineSnapshot(`
        "INFO 2026-09-17T18:51:02Z
        next line done"
      `);
  });
});
describe("the recent block's scroll", () => {
  it("clamps the held offset to what the track can show", () => {
    expect([recentOffset(-1000, 320, 663), recentOffset(50, 320, 663), recentOffset(-50, 320, 68)])
      .toMatchInlineSnapshot(`
        [
          -343,
          0,
          0,
        ]
      `);
  });
  it("moves the recent block by the offset without reordering it", () => {
    const base = squaresOf(recentFrame(40), { cellHeight: 17, track: 320 });
    const shifted = squaresOf(recentFrame(40), { cellHeight: 17, track: 320 }, -200);
    expect(shifted.squares.map((square) => square.y)).toEqual(base.squares.map((square) => square.y - 200));
    expect(shifted.squares.map((square) => square.id)).toEqual(base.squares.map((square) => square.id));
  });
});
describe("a resize the strip answers", () => {
  const drawn = { width: 800, height: 600 };
  it("repaints when the pane's box moves off the one the strip drew at", () => {
    expect([boxMoved(drawn, 700, 600), boxMoved(drawn, 800, 640), boxMoved(drawn, 700.5, 600)]).toEqual([true, true, true]);
  });
  it("sits still while the box repeats, sub-pixel drift included", () => {
    expect([boxMoved(drawn, 800, 600), boxMoved(drawn, 800.4, 600.4)]).toEqual([false, false]);
  });
  it("has nothing to re-project before the first frame", () => {
    expect(boxMoved(undefined, 700, 600)).toBe(false);
  });
});
it("uses the resolved square step for the recent block", () => {
  const props = themedSquaresOf(recentFrame(3), { cellHeight: 17, track: 320 }, 0, 20);
  expect(props.squares.map((square) => square.y)).toEqual([140, 160, 180]);
});
