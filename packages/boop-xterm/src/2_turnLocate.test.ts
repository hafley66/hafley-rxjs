import { describe, expect, it } from "vitest";
import { locateVisibleTurns, dropTerminalInputRows, selectProjectionTurns } from "./2_turnLocate.js";
import type { BoopTurn } from "./0_types.js";
import { boopContent, normalizeTurnLine, sourceLines } from "./1_turnMatching.js";

const turn = (turn: number, said: string): BoopTurn => ({
  session: "session-a", harness: "codex", turn, ts: turn, role: "assistant", said,
});

describe("terminal turn location", () => {
  it("matches and counts user content after the verified Boop envelope", () => {
    const raw = "[boop m1 from coordinator]\nactual user text\nsecond line";
    const user = { ...turn(1, raw), role: "user" };
    const plain = { ...turn(2, "[ordinary brackets] user XML <example>kept</example>"), role: "user" };
    const only = { ...turn(3, "[boop m2 from feature/tls]"), role: "user" };
    const lines = ["❯ [boop m1 from coordinator] actual user text", "second line"]
      .map((text, index) => ({ text, start: index, end: index }));
    expect({
      source: sourceLines(user),
      matched: locateVisibleTurns(lines, [user, only]).map(({ turn, anchorStart, anchorEnd }) => ({ turn, anchorStart, anchorEnd })),
      prefixOnly: boopContent(only.said),
      literal: boopContent(plain.said),
      supportedXml: boopContent("<system-reminder>injected</system-reminder>"),
      durableRaw: user.said,
    }).toMatchInlineSnapshot(`
      {
        "durableRaw": "[boop m1 from coordinator]
      actual user text
      second line",
        "literal": "[ordinary brackets] user XML <example>kept</example>",
        "matched": [
          {
            "anchorEnd": 1,
            "anchorStart": 0,
            "turn": 1,
          },
        ],
        "prefixOnly": "",
        "source": [
          "actual user text",
          "second line",
        ],
        "supportedXml": "<system-reminder>injected</system-reminder>",
      }
    `);
  });

  it("keeps pane-bound parent turns ahead of a newer guardian embedding their transcript", () => {
    const parent = [
      { ...turn(214, "push to main thanks"), session: "parent", role: "user", ts: 1_000, session_scope: "root" as const },
      { ...turn(215, "Using the git-commit skill to resolve the intended repository."), session: "parent", ts: 1_010, session_scope: "root" as const },
    ];
    const guardian = [{
      ...turn(229, [
        "The following is the Codex agent history added since your last approval assessment.",
        "[214] user: push to main thanks",
        "[215] assistant: Using the git-commit skill to resolve the intended repository.",
      ].join("\n")),
      session: "guardian",
      role: "user",
      ts: 1_111,
      session_scope: "child" as const,
      parent_session: "parent",
    }];
    const selected = selectProjectionTurns(guardian, parent);
    const located = locateVisibleTurns([
      { text: "› push to main thanks", start: 40, end: 40 },
      { text: "", start: 41, end: 41 },
      { text: "Using the git-commit skill to resolve the intended repository.", start: 42, end: 42 },
    ], selected);
    expect({
      sources: selected.map(({ session, turn, role }) => ({ session, turn, role })),
      rows: [40, 42].map((row) => {
        const found = located.find((candidate) =>
          candidate.anchorStart <= row && row <= candidate.anchorEnd);
        return { row, id: found?.id, role: found?.role };
      }),
    }).toMatchInlineSnapshot(`
      {
        "rows": [
          {
            "id": "parent:214",
            "role": "user",
            "row": 40,
          },
          {
            "id": "parent:215",
            "role": "assistant",
            "row": 42,
          },
        ],
        "sources": [
          {
            "role": "user",
            "session": "parent",
            "turn": 214,
          },
          {
            "role": "assistant",
            "session": "parent",
            "turn": 215,
          },
        ],
      }
    `);
  });

  it("keeps a marked user prompt when the following assistant quotes it", () => {
    const located = locateVisibleTurns([
      { text: "❯ please track the financial product outputs of a research agent yes", start: 1, end: 1 },
      { text: "", start: 2, end: 2 },
      { text: "The research agent output is now tracked.", start: 3, end: 3 },
    ], [
      { ...turn(1, "please track the financial product outputs of a research agent yes"), role: "user" },
      turn(2, "please track the financial product outputs of a research agent yes\nThe research agent output is now tracked."),
    ]);
    expect(located.map(({ turn: number, role, anchorStart, anchorEnd }) => ({
      turn: number,
      role,
      anchorStart,
      anchorEnd,
    }))).toMatchInlineSnapshot(`
      [
        {
          "anchorEnd": 1,
          "anchorStart": 1,
          "role": "user",
          "turn": 1,
        },
        {
          "anchorEnd": 3,
          "anchorStart": 3,
          "role": "assistant",
          "turn": 2,
        },
      ]
    `);
    expect(locateVisibleTurns(
      [{ text: "❯ quoted syntax in an assistant answer", start: 8, end: 8 }],
      [turn(3, "❯ quoted syntax in an assistant answer")],
    ).map(({ turn: number }) => number)).toEqual([3]);
  });

  it("uses cwd-wide candidates only until a pane-bound session has turns", () => {
    const candidates = [{ ...turn(229, "embedded parent transcript"), session: "guardian", role: "user" }];
    const direct = [{ ...turn(214, "parent prompt"), session: "parent", role: "user" }];
    expect(selectProjectionTurns([], candidates).map((row) => row.session)).toEqual(["guardian"]);
    expect(selectProjectionTurns(direct, candidates).map((row) => row.session)).toEqual(["parent"]);
  });

  it("recomputes a Codex multiline composer band after submit collapses it", () => {
    const before = [
      { text: "› prior user turn", start: 10, end: 10 },
      { text: "assistant answer", start: 11, end: 11 },
      { text: "", start: 12, end: 12 },
      { text: "› first pasted line", start: 13, end: 13 },
      { text: "  second pasted line", start: 14, end: 14 },
      { text: "  third pasted line", start: 15, end: 15 },
      { text: "gpt-5.6-sol · ~/projects · Approve for me · Context 41%", start: 16, end: 16 },
    ];
    const after = [
      { text: "› first pasted line", start: 20, end: 20 },
      { text: "  second pasted line", start: 21, end: 21 },
      { text: "  third pasted line", start: 22, end: 22 },
      { text: "", start: 23, end: 23 },
      { text: "assistant answer after submit", start: 24, end: 24 },
      { text: "", start: 25, end: 25 },
      { text: "› Ask Codex to do anything", start: 26, end: 26 },
      { text: "gpt-5.6-sol · ~/projects · Approve for me · Context 40%", start: 27, end: 27 },
    ];
    expect(dropTerminalInputRows(before, "codex").map((line) => line.start))
      .toEqual([10, 11, 12]);
    expect(dropTerminalInputRows(after, "codex").map((line) => line.start))
      .toEqual([20, 21, 22, 23, 24, 25]);
    const found = locateVisibleTurns(dropTerminalInputRows(after, "codex"), [
      { ...turn(22, "first pasted line\nsecond pasted line\nthird pasted line"), role: "user" },
      turn(23, "assistant answer after submit"),
    ]);
    expect([20, 21, 22, 24].map((row) => {
      const hit = found.find((candidate) => candidate.anchorStart <= row && row <= candidate.anchorEnd);
      return [row, hit?.turn, hit?.role];
    })).toMatchInlineSnapshot(`
      [
        [
          20,
          22,
          "user",
        ],
        [
          21,
          22,
          "user",
        ],
        [
          22,
          22,
          "user",
        ],
        [
          24,
          23,
          "assistant",
        ],
      ]
    `);
  });

  it("keeps semantic identities while resize reprojects logical lines onto new physical rows", () => {
    const turns = [
      { ...turn(30, "a parent prompt whose logical line wraps at narrow widths"), role: "user" },
      turn(31, "an assistant response whose logical line also wraps at narrow widths"),
    ];
    const wide = locateVisibleTurns([
      { text: "› a parent prompt whose logical line wraps at narrow widths", start: 100, end: 100 },
      { text: "", start: 101, end: 101 },
      { text: "an assistant response whose logical line also wraps at narrow widths", start: 102, end: 102 },
    ], turns);
    const narrow = locateVisibleTurns([
      { text: "› a parent prompt whose logical line wraps at narrow widths", start: 200, end: 202 },
      { text: "", start: 203, end: 203 },
      { text: "an assistant response whose logical line also wraps at narrow widths", start: 204, end: 207 },
    ], turns);
    expect({
      wide: wide.map(({ id, role, anchorStart, anchorEnd }) => ({ id, role, anchorStart, anchorEnd })),
      narrow: narrow.map(({ id, role, anchorStart, anchorEnd }) => ({ id, role, anchorStart, anchorEnd })),
    }).toMatchInlineSnapshot(`
      {
        "narrow": [
          {
            "anchorEnd": 202,
            "anchorStart": 200,
            "id": "session-a:30",
            "role": "user",
          },
          {
            "anchorEnd": 207,
            "anchorStart": 204,
            "id": "session-a:31",
            "role": "assistant",
          },
        ],
        "wide": [
          {
            "anchorEnd": 100,
            "anchorStart": 100,
            "id": "session-a:30",
            "role": "user",
          },
          {
            "anchorEnd": 102,
            "anchorStart": 102,
            "id": "session-a:31",
            "role": "assistant",
          },
        ],
      }
    `);
  });

  it("normalizes terminal chrome and locates unique Boop turns", () => {
    const rows = [
      { text: "⏺ Alpha response with a stable phrase", start: 40, end: 40 },
      { text: "  shared trailing sentence", start: 41, end: 41 },
      { text: "› Beta request with another stable phrase", start: 42, end: 43 },
    ];
    expect(normalizeTurnLine(rows[0].text)).toBe("alpha response with a stable phrase");
    expect(locateVisibleTurns(rows, [
      turn(7, "Alpha response with a stable phrase\nshared trailing sentence"),
      turn(8, "Beta request with another stable phrase\nshared trailing sentence"),
    ])).toMatchInlineSnapshot(`
      [
        {
          "anchorEnd": 41,
          "anchorStart": 40,
          "bufferEnd": 41,
          "bufferStart": 40,
          "confidence": "anchored",
          "harness": "codex",
          "id": "session-a:7",
          "regions": [],
          "role": "assistant",
          "said": "Alpha response with a stable phrase
      shared trailing sentence",
          "session": "session-a",
          "source": "xterm+boop",
          "ts": 7,
          "turn": 7,
        },
        {
          "anchorEnd": 43,
          "anchorStart": 42,
          "bufferEnd": 43,
          "bufferStart": 42,
          "clippedBelow": true,
          "confidence": "anchored",
          "harness": "codex",
          "id": "session-a:8",
          "regions": [],
          "role": "assistant",
          "said": "Beta request with another stable phrase
      shared trailing sentence",
          "session": "session-a",
          "source": "xterm+boop",
          "ts": 8,
          "turn": 8,
        },
      ]
    `);
  });

  it("keeps multiline source and wrapped xterm rows under one turn identity", () => {
    expect(locateVisibleTurns([
      { text: "first source line", start: 10, end: 10 },
      { text: "one long logical source line wrapped by xterm", start: 11, end: 13 },
      { text: "last source line", start: 14, end: 14 },
    ], [turn(9, [
      "first source line",
      "one long logical source line wrapped by xterm",
      "last source line",
    ].join("\n"))])).toMatchInlineSnapshot(`
      [
        {
          "anchorEnd": 14,
          "anchorStart": 10,
          "bufferEnd": 14,
          "bufferStart": 10,
          "confidence": "anchored",
          "harness": "codex",
          "id": "session-a:9",
          "regions": [],
          "role": "assistant",
          "said": "first source line
      one long logical source line wrapped by xterm
      last source line",
          "session": "session-a",
          "source": "xterm+boop",
          "ts": 9,
          "turn": 9,
        },
      ]
    `);
  });

  it("selects the compact parent turn over an approval transcript containing the same response", () => {
    const response = [
      "Properties:",
      "- Every streamed write resets the quiet timer.",
      "- switchMap cancels the previous wait.",
      "- No polling.",
    ].join("\n");
    const parent = { ...turn(14, response), session: "parent", ts: 140 };
    const approval = {
      ...turn(80, [
        "Review the following proposed response:",
        "<assistant_response>",
        response,
        "</assistant_response>",
        "Return an approval decision.",
      ].join("\n")),
      session: "approval-child",
      ts: 150,
    };
    expect(locateVisibleTurns([
      { text: "Properties:", start: 70, end: 70 },
      { text: "- Every streamed write resets the quiet timer.", start: 71, end: 71 },
      { text: "- switchMap cancels the previous wait.", start: 72, end: 72 },
      { text: "- No polling.", start: 73, end: 73 },
    ], [approval, parent]).map(({ id, bufferStart, bufferEnd }) => ({ id, bufferStart, bufferEnd })))
      .toMatchInlineSnapshot(`
        [
          {
            "bufferEnd": 73,
            "bufferStart": 70,
            "id": "parent:14",
          },
        ]
      `);
  });

  // Defect receipt 2026-08-22: right-click inside a long assistant report
  // resolved to the previous user turn. Every report line carried inline code
  // beside punctuation ("(`5a38640`)"); spacing the backticks out produced
  // "( 5a38640 )", which never matched the rendered "(5a38640)", so the turn
  // had no anchor and the user turn's extended span swallowed it.
  it("matches inline code and bold beside punctuation the way the pane renders them", () => {
    const said = [
      "**instant: turn-visibility scan cost** (instant `51c9a89` + hafley-rs `8bb7dc9`)",
      "",
      "Receipts: instant PID 80115 rebuilt by `tauri dev`, 6 one-second samples `0.0 3.1` %CPU.",
    ].join("\n");
    expect(normalizeTurnLine("instant: turn-visibility scan cost (instant 51c9a89 + hafley-rs 8bb7dc9)"))
      .toBe(normalizeTurnLine(said.split("\n")[0]));
    const rows = [
      { text: "› yes get it fixed with receipts", start: 10, end: 10 },
      { text: "", start: 11, end: 11 },
      { text: "instant: turn-visibility scan cost (instant 51c9a89 + hafley-rs 8bb7dc9)", start: 12, end: 12 },
      { text: "", start: 13, end: 13 },
      { text: "Receipts: instant PID 80115 rebuilt by tauri dev, 6 one-second samples 0.0 3.1 %CPU.", start: 14, end: 14 },
    ];
    const turns = [
      { ...turn(160, "yes get it fixed with receipts"), role: "user" },
      turn(192, said),
    ];
    const visible = locateVisibleTurns(rows, turns);
    const at = (row: number) => visible.find((v) => v.bufferStart <= row && row <= v.bufferEnd)?.turn;
    expect(at(10)).toBe(160);
    expect(at(12)).toBe(192);
    expect(at(14)).toBe(192);
    const identity = (row: number) => visible.find((v) => v.anchorStart <= row && row <= v.anchorEnd)?.turn ?? null;
    expect(identity(10)).toBe(160);
    expect(identity(12)).toBe(192);
    expect(identity(14)).toBe(192);
    expect(identity(11)).toBeNull();
    expect(identity(13)).toBe(192);
  });

  it("normalizes unicode box-drawing characters in tables and borders to match markdown turns", () => {
    const tableScreen = [
      { text: "   Boop mechanism                       Common systems concept", start: 1, end: 1 },
      { text: "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", start: 2, end: 2 },
      { text: "   Inspecting WebSocket relay           Sidecar or transparent protocol proxy", start: 3, end: 3 },
      { text: "  ───────────────────────────────────  ──────────────────────────────────────────────────────", start: 4, end: 4 },
      { text: "   Unix domain sockets                  Local IPC used by editors, language servers, daemons", start: 5, end: 5 },
    ];
    const markdownTurn = turn(10135, [
      "| Boop mechanism | Common systems concept |",
      "|---|---|",
      "| Inspecting WebSocket relay | Sidecar or transparent protocol proxy |",
      "| Unix domain sockets | Local IPC used by editors, language servers, daemons |",
    ].join("\n"));

    expect(normalizeTurnLine(tableScreen[1].text)).toBe("");
    expect(normalizeTurnLine(tableScreen[2].text)).toBe("inspecting websocket relay sidecar or transparent protocol proxy");
    expect(locateVisibleTurns(tableScreen, [markdownTurn]).map(({ id, bufferStart, bufferEnd }) => ({ id, bufferStart, bufferEnd })))
      .toMatchInlineSnapshot(`
        [
          {
            "bufferEnd": 5,
            "bufferStart": 1,
            "id": "session-a:10135",
          },
        ]
      `);
  });

  // Defect receipt 2026-08-29 (lab-claude, lab-ccz): the separator class held
  // the horizontal rules but never the vertical Claude Code puts between cells,
  // so every table data row failed to match and the turn anchored on prose only.
  it("matches a rendered table's data rows through the vertical cell separator", () => {
    const screen = [
      { text: "  ┌─────────┬────────────┐", start: 4, end: 4 },
      { text: "  │ fixture │    tmux    │", start: 5, end: 5 },
      { text: "  ├─────────┼────────────┤", start: 6, end: 6 },
      { text: "  │ claude  │ lab-claude │", start: 7, end: 7 },
      { text: "  └─────────┴────────────┘", start: 8, end: 8 },
    ];
    expect(normalizeTurnLine(screen[1].text)).toBe("fixture tmux");
    expect(normalizeTurnLine(screen[0].text)).toBe("");
    const source = turn(41, ["| fixture | tmux |", "| --- | --- |", "| claude | lab-claude |"].join("\n"));
    const [located] = locateVisibleTurns(screen, [source]);
    expect(located.anchorStart).toBe(5);
    expect(located.anchorEnd).toBe(7);
  });

  // Defect receipt 2026-08-29 (lab-claude at 80 cols): the monotonic match is
  // 1:1, so one source line an app hard-wraps across three rows anchored one.
  it("anchors every row an app hard-wraps out of a single source line", () => {
    const said = "markdown tables in claude code get responsive designed into a list mode "
      + "so there are two renders for it, and code and tool calls";
    const screen = [
      { text: "  unrelated banner line", start: 20, end: 20 },
      { text: "  markdown tables in claude code get responsive designed into", start: 21, end: 21 },
      { text: "  a list mode so there are two renders for it, and code and", start: 22, end: 22 },
      { text: "  tool calls", start: 23, end: 23 },
    ];
    const [located] = locateVisibleTurns(screen, [turn(58, said)]);
    expect(located.anchorStart).toBe(21);
    // Row 23 normalizes to "tool calls", under the 12-character floor a
    // containment match needs, so a short trailing fragment stays unanchored.
    expect(located.anchorEnd).toBe(22);
    expect(normalizeTurnLine(screen[3].text).length).toBeLessThan(12);
  });

  // Defect receipt 2026-08-29 (lab-kimi): kimi prefixes a user message with ✨,
  // and Claude Code uses ✻ and ⎿; none were in the leading-marker class, so an
  // otherwise exact line missed by one glyph.
  it("strips the per-harness message markers kimi and claude code print", () => {
    const said = "i guess lab it out with joernn and then see if rust can go faster";
    for (const marker of ["✨", "✻", "⎿", "⏺"]) {
      expect(normalizeTurnLine(`${marker} ${said}`)).toBe(said);
    }
    const screen = [{ text: `✨ ${said}`, start: 8, end: 8 }];
    const [located] = locateVisibleTurns(screen, [turn(507, said)]);
    expect(located.turn).toBe(507);
    expect(located.anchorStart).toBe(8);
  });

  // Defect receipt 2026-08-29 (lab-kimi): a skill-instruction turn claimed eight
  // rows of an unrelated diff because one short line of its body appeared inside
  // them, so containment now has to cover half the longer string.
  it("refuses a short source line found inside a much longer rendered row", () => {
    const screen = [
      { text: "  3 + head-to-head framing from 2026-07-25: run joern first as the reference, then the rust lab as challenger", start: 19, end: 19 },
      { text: "  4 + soufflé and kuzu become optional fillers only when the head-to-head stays inconclusive after both runs", start: 20, end: 20 },
    ];
    const skill = turn(481, ["Skill tool loaded instructions for this request.", "run joern", "## Naming"].join("\n"));
    expect(locateVisibleTurns(screen, [skill])).toEqual([]);
  });

  // Defect receipt 2026-08-29: the right-click menu reads turnAtClientPoint,
  // which reads turnAtBufferRow. Every other test asserts the located spans
  // directly, so the accessor itself needs one that drives the real class.
  it("keeps an unambiguous short non-tool turn", () => {
    expect(locateVisibleTurns([{ text: "done", start: 1, end: 1 }], [
      { ...turn(1, "done"), session: "edge" },
    ]).map(({ id, anchorStart, anchorEnd }) => ({ id, anchorStart, anchorEnd }))).toEqual([
      { id: "edge:1", anchorStart: 1, anchorEnd: 1 },
    ]);
  });

  it("leaves identical structured tool calls unassigned", () => {
    const said = "bash\n{\"command\":\"echo repeated-tool-command\"}";
    expect(locateVisibleTurns([{ text: "│ $ echo repeated-tool-command", start: 1, end: 1 }], [
      { ...turn(1, said), session: "edge", role: "tool" },
      { ...turn(2, said), session: "edge", role: "tool" },
    ])).toEqual([]);
  });

  it("decodes formatted structured tool arguments after the first newline", () => {
    const said = ["bash", "{", '  "command": "echo formatted-tool-command"', "}"].join("\n");
    expect(locateVisibleTurns([{ text: "│ $ echo formatted-tool-command", start: 1, end: 1 }], [
      { ...turn(1, said), session: "edge", role: "tool" },
    ]).map(({ id, anchorStart, anchorEnd }) => ({ id, anchorStart, anchorEnd }))).toEqual([
      { id: "edge:1", anchorStart: 1, anchorEnd: 1 },
    ]);
  });

  it("rejects an accepted anchor interval that intersects an earlier interval", () => {
    const visible = locateVisibleTurns([
      { text: "alpha", start: 1, end: 1 },
      { text: "bravo", start: 2, end: 2 },
      { text: "charlie", start: 3, end: 3 },
    ], [
      { ...turn(1, "alpha\ncharlie"), session: "edge" },
      { ...turn(2, "bravo"), session: "edge" },
    ]);
    expect(visible.map(({ id, bufferStart, bufferEnd }) => ({ id, bufferStart, bufferEnd }))).toEqual([
      { id: "edge:1", bufferStart: 1, bufferEnd: 3 },
    ]);
  });
});
