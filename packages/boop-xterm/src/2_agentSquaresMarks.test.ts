import { expect, it } from "vitest";
import { marksOf } from "./2_agentSquaresMarks.js";
import type { Strip } from "./1_agentSquaresFeed.js";

it("projects frame tags and explicit favorite sources", () => {
  const turn = { session: "s1", harness: "claude", turn: 2, ts: 1, role: "assistant", said: "reply",
    id: "s1:2", bufferStart: 0, bufferEnd: 0, anchorStart: 0, anchorEnd: 0, confidence: "anchored" as const };
  const frame: Strip = { session: "s1", at: 1, rows: 20, turns: [turn], pinned: [],
    tags: { "turn:s1:2": ["diagram"] }, layout: null };
  expect([...marksOf(frame, new Set(["turn:s1:2"]))]).toMatchInlineSnapshot(`
    [
      [
        "s1:2",
        {
          "favorite": true,
          "tags": [
            "diagram",
          ],
        },
      ],
    ]
  `);
});
