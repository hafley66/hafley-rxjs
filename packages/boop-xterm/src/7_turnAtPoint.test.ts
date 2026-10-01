import { expect, it } from "vitest";
import type { Terminal } from "@xterm/xterm";
import type { VisibleTurn } from "./0_types.js";
import { turnAtClientPoint } from "./7_turnAtPoint.js";
import { setTerminalStatus } from "./0_tmuxStatus.js";

it("hits the painted turn beyond its anchors after the host moves, and excludes status", () => {
  const turns = [{ id: "s:1", bufferStart: 0, bufferEnd: 4, anchorStart: 2, anchorEnd: 2 }] as VisibleTurn[];
  const term = { rows: 5, buffer: { active: { baseY: 0, viewportY: 0 } } } as Terminal;
  let top = 100;
  const rect = () => ({ left: 10, right: 110, top, bottom: top + 100, height: 100 });
  const host = { getBoundingClientRect: rect, querySelector: () => ({ getBoundingClientRect: rect }) } as unknown as HTMLElement;
  setTerminalStatus(term, { position: "top", rows: 1 });
  const before = [110, 130, 150, 190].map((y) => turnAtClientPoint(turns, term, host, 20, y)?.id ?? null);
  top = 300;
  const after = [130, 310, 330, 390, 400].map((y) => turnAtClientPoint(turns, term, host, 20, y)?.id ?? null);
  expect({ before, after }).toMatchInlineSnapshot(`
    {
      "after": [
        null,
        null,
        "s:1",
        "s:1",
        null,
      ],
      "before": [
        null,
        "s:1",
        "s:1",
        "s:1",
      ],
    }
  `);
});
