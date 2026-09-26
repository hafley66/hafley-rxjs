import { describe, expect, it } from "vitest";
import type { Terminal } from "@xterm/xterm";
import { diagramElementAtPoint, diagramElementKey, findDiagramFences, mergeLocatedDiagrams, projectedDiagramIsCurrent, svgAspectRatio, type DiagramFence } from "./1_terminalDiagrams.js";
import type { ProjectedTurnRegion } from "./0_turnRegions.js";
import { openRealTerminal, writeTerminal } from "./test/1_realTerminal.js";

async function terminalWithRows(rows: string[]): Promise<Terminal> {
  const { term } = openRealTerminal();
  term.resize(160, Math.max(20, rows.length + 2));
  await writeTerminal(term, rows.join("\r\n"));
  return term;
}

describe("terminal diagram fences", () => {
  it("keeps a fence whose opener or closer carries the copy-mode indicator", async () => {
    const term = await terminalWithRows(["```mermaid          [3/120]", "graph LR; a --> b", "```                  [4/120]"]);
    expect(findDiagramFences(term).map(({ language, code, start, end }) => ({ language, code, start, end })))
      .toMatchInlineSnapshot(`
        [
          {
            "code": "graph LR; a --> b",
            "end": 2,
            "language": "mermaid",
            "start": 0,
          },
        ]
      `);
  });
  it("captures rich D2 with internal blank rows and stops at assistant prose", async () => {
    const term = await terminalWithRows(["• d2", "  direction: right", "", "  classes: {", "    ok: {", "      style.fill: \"#d3f9d8\"", "    }", "  }", "", "  IN: inputs { class: ok }", "  IN -> OUT", "Self-contained: no imported house file."]);
    const fence = findDiagramFences(term)[0];
    expect({ language: fence.language, stripped: fence.stripped, start: fence.start, end: fence.end,
      lines: fence.code.split("\n").length, tail: fence.code.split("\n").at(-1) })
      .toMatchInlineSnapshot(`
        {
          "end": 10,
          "language": "d2",
          "lines": 10,
          "start": 0,
          "stripped": true,
          "tail": "IN -> OUT",
        }
      `);
  });
  it("splits two zero-indent mermaid blocks separated by prose", async () => {
    const term = await terminalWithRows(["2. Today, four tables", "mermaid", "flowchart LR", "  P[\"your program\"]", "  R[\"registry.pl\"]", "  P --> R", "", "3. After, one table", "mermaid", "flowchart LR", "  P2[\"rel soopy.files\"]", "  L2[\"LINKED_EXECUTORS\"]", "  P2 --> L2", ""]);
    expect(findDiagramFences(term).map(({ start, end, code }) => ({ start, end, code }))).toMatchInlineSnapshot(`
      [
        {
          "code": "flowchart LR
        P["your program"]
        R["registry.pl"]
        P --> R",
          "end": 5,
          "start": 1,
        },
        {
          "code": "flowchart LR
        P2["rel soopy.files"]
        L2["LINKED_EXECUTORS"]
        P2 --> L2",
          "end": 12,
          "start": 8,
        },
      ]
    `);
  });
  it("infers an opencode assistant timeline whose fence and label the TUI stripped", async () => {
    const term = await terminalWithRows(["     The zorbulon migration runs in three phases.", "", "     timeline", "         title zorbulon migration roadmap", "         Q1 : harvest the quux", "         Q2 : align the frobnicator", "         Q3 : ship zorbulon v2", "", "     Nothing else is in scope this quarter."]);
    const fences = findDiagramFences(term);
    expect(fences.map(({ language, start, end, inferred, code }) => ({ language, start, end, inferred, code }))).toMatchInlineSnapshot(`
      [
        {
          "code": "timeline
          title zorbulon migration roadmap
          Q1 : harvest the quux
          Q2 : align the frobnicator
          Q3 : ship zorbulon v2",
          "end": 6,
          "inferred": true,
          "language": "mermaid",
          "start": 2,
        },
      ]
    `);
  });
  it("reads SVG dimensions and rejects missing renderer output", () => {
    expect([svgAspectRatio('<svg viewBox="0 0 640 320"></svg>'), svgAspectRatio('<svg width="300" height="600"></svg>'), svgAspectRatio(undefined), svgAspectRatio("<svg></svg>")])
      .toMatchInlineSnapshot(`
        [
          2,
          0.5,
          null,
          null,
        ]
      `);
  });
  it("selects the last painted diagram when allocated rows overlap", () => {
    const { host } = openRealTerminal();
    const lower = document.createElement("div");
    lower.dataset.diagramKey = "lower";
    lower.style.cssText = "position:absolute;left:0;top:100px;width:800px;height:400px";
    const upper = document.createElement("div");
    upper.dataset.diagramKey = "visible-top";
    upper.style.cssText = "position:absolute;left:0;top:300px;width:800px;height:400px";
    host.append(lower, upper);
    expect(diagramElementAtPoint([lower, upper], 400, 400)?.dataset.diagramKey).toBe("visible-top");
  });
  it("rejects a projected diagram after its buffer rows contain different source", async () => {
    const term = await terminalWithRows(["flowchart LR", "CURRENT --> GRAPH", "GRAPH --> OUTPUT"]);
    const region: ProjectedTurnRegion = { id: "turn:mermaid:1", turnId: "turn", kind: "mermaid", sourceStart: 1, sourceEnd: 5,
      text: "flowchart LR\nOLD --> PLAN\nPLAN --> MAIN", bufferStart: 0, bufferEnd: 2, sourceBufferRows: [null, 0, 1, 2, null] };
    expect(projectedDiagramIsCurrent(term, region)).toBe(false);
  });
  it("accepts a projected diagram whose source still occupies its mapped rows", async () => {
    const term = await terminalWithRows(["flowchart LR", "CURRENT --> GRAPH", "GRAPH --> OUTPUT"]);
    const region: ProjectedTurnRegion = { id: "turn:mermaid:1", turnId: "turn", kind: "mermaid", sourceStart: 1, sourceEnd: 5,
      text: "flowchart LR\nCURRENT --> GRAPH\nGRAPH --> OUTPUT", bufferStart: 0, bufferEnd: 2, sourceBufferRows: [null, 0, 1, 2, null] };
    expect(projectedDiagramIsCurrent(term, region)).toBe(true);
  });
  it("retains an explicit terminal fence while the ledger has no located match", () => {
    const fence: DiagramFence = { language: "d2", code: "terminal -> tmux -> xterm", start: 12, end: 14, inferred: false };
    expect(mergeLocatedDiagrams([fence], [])).toEqual([fence]);
  });
  it("keeps visible terminal source over an overlapping stale ledger estimate", () => {
    const direct: DiagramFence = { language: "mermaid", code: "flowchart LR\n1 --> 2 --> 3", start: 20, end: 21, inferred: true };
    const stale: DiagramFence = { language: "mermaid", code: "flowchart LR\nold --> tall --> diagram", start: 20, end: 31, inferred: false };
    expect(mergeLocatedDiagrams([direct], [stale])).toEqual([direct]);
  });
  it("completes a clipped visible prefix from the matching ledger diagram", () => {
    const clipped: DiagramFence = { language: "mermaid", code: "flowchart LR\n  PTY --> tmux", start: 20, end: 21, inferred: true };
    const complete: DiagramFence = { language: "mermaid", code: "flowchart LR\n  PTY --> tmux\n  tmux --> xterm\n  xterm --> Mermaid", start: 20, end: 23, inferred: false };
    expect(mergeLocatedDiagrams([clipped], [complete])).toEqual([complete]);
  });
  it("uses one row-scoped DOM identity across terminal and ledger indentation", () => {
    const direct: DiagramFence = { language: "mermaid", code: "flowchart LR\n    PTY --> tmux\n    tmux --> xterm", start: 20, end: 22, inferred: true };
    const ledger = { ...direct, code: "flowchart LR\n  PTY --> tmux\n  tmux --> xterm", inferred: false };
    expect(diagramElementKey(direct, true)).toBe(diagramElementKey(ledger, true));
  });
  it("keeps the DOM element when a projected fence's buffer rows shift", () => {
    const fence = (start: number, end: number): DiagramFence => ({ language: "mermaid", code: "flowchart LR\n  A --> B", start, end, inferred: false, locator: "boop:turn:1", messageId: "turn:1" });
    expect(diagramElementKey(fence(10, 12), false)).toBe(diagramElementKey(fence(11, 13), false));
  });
  it("ends a stripped mermaid fence at a box-drawn table row", async () => {
    const term = await terminalWithRows(["mermaid", "flowchart LR", "  A --> B", "┌──────┐", "│ next │"]);
    expect(findDiagramFences(term).map(({ start, end }) => ({ start, end }))).toEqual([{ start: 0, end: 2 }]);
  });
  it("ends a stripped mermaid fence at the first blank row before same-indent prose", async () => {
    const term = await terminalWithRows(["mermaid", "flowchart LR", "  A --> B", "", "  This prose follows."]);
    expect(findDiagramFences(term)[0].code).toBe("flowchart LR\n  A --> B");
  });
  it("ends stripped and inferred fences at bullet, prompt and dedented rows", async () => {
    const term = await terminalWithRows(["mermaid", "flowchart LR", "  A --> B", "• next", "timeline", "  Q1 : go", "  Q2 : done", "$ prompt"]);
    expect(findDiagramFences(term).map(({ start, end }) => ({ start, end }))).toEqual([{ start: 0, end: 2 }, { start: 4, end: 6 }]);
  });
  it("detects explicit fences, then label rows, then unlabeled bodies as the setting widens", async () => {
    const term = await terminalWithRows(["```mermaid", "flowchart LR", "A --> B", "```", "", "mermaid", "flowchart LR", "  B --> C", "", "timeline", "  Q1 : go"]);
    expect(["explicit", "labels", "inferred"].map((level) => findDiagramFences(term, level as "explicit" | "labels" | "inferred").length)).toEqual([1, 2, 3]);
  });
});
