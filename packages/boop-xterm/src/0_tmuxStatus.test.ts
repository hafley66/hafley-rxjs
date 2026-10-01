import { expect, it } from "vitest";
import type { Terminal } from "@xterm/xterm";
import { isTerminalContentRow, setTerminalStatus, terminalStatusRange } from "./0_tmuxStatus.js";
import { readVisibleLogicalLines } from "./4_viewport.js";

it("tracks top, bottom, multirow and disabled status without shifting buffer coordinates", () => {
  const term = {
    rows: 5,
    buffer: { active: { baseY: 20, viewportY: 20, length: 25,
      getLine: (row: number) => ({ isWrapped: false, translateToString: () => `row ${row}` }),
    } },
  } as unknown as Terminal;
  const states = ([{ position: "bottom", rows: 1 }, { position: "top", rows: 1 },
    { position: "top", rows: 2 }, { position: "bottom", rows: 0 }] as const).map((status) => {
    setTerminalStatus(term, status);
    return { status, range: terminalStatusRange(term), lines: readVisibleLogicalLines(term),
      selectable: [19, 20, 21, 23, 24].map((row) => isTerminalContentRow(term, row)) };
  });
  expect(states).toMatchSnapshot();
  setTerminalStatus(term, null);
});
