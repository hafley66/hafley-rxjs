import type { VisibleTurn } from "./0_types.js";
import type { TerminalRowGeometry } from "./1_rowGeometry.js";
import type { VisibleTerminalLine } from "./3_ports.js";

export const gutter_offset_px = 42;
export const gutter_check_px = 16;

export type StructuredSelectable = {
  id: string;
  kind: "table" | "list" | "heading";
  text: string;
  turnId: string;
  bufferRow: number;
};

const listItem = /^\s*(?:[│┃]\s*)?(?:[-+*•]|\d+[.)])\s+\S/;
const tableSeparator = /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+(?:\s*:?-{3,}:?\s*)\|?\s*$/;

type VisibleSourceLine = { bufferStart: number; text: string };

function normalizeSelectableLine(line: string): string {
  return line.toLowerCase().replace(/[`_*~#|]/g, " ").replace(/\s+/g, " ").trim();
}

function selectableBufferRow(
  region: VisibleTurn["regions"][number],
  sourceRow: number,
  sourceLine: string,
  visibleLines: VisibleSourceLine[],
): number | null {
  if (region.sourceBufferRows?.[sourceRow] !== null && region.sourceBufferRows?.[sourceRow] !== undefined) {
    return region.sourceBufferRows[sourceRow];
  }
  if (region.sourceBufferRows) {
    const source = normalizeSelectableLine(sourceLine);
    return visibleLines.find((line) => normalizeSelectableLine(line.text) === source)?.bufferStart ?? null;
  }
  return region.bufferStart + sourceRow;
}

export function structuredSelectables(
  turns: Array<Pick<VisibleTurn, "regions">>,
  visibleLines: VisibleSourceLine[] = [],
): StructuredSelectable[] {
  return turns.flatMap((turn) => turn.regions.flatMap((region): StructuredSelectable[] => {
    if (region.kind !== "table" && region.kind !== "list" && region.kind !== "heading") return [];
    const lines = region.text.split("\n");
    if (region.kind === "heading") {
      const bufferRow = selectableBufferRow(region, 0, lines[0], visibleLines);
      return bufferRow === null ? [] : [{
        id: `${region.id}:heading`,
        kind: "heading" as const,
        text: lines[0],
        turnId: region.turnId,
        bufferRow,
      }];
    }
    if (region.kind === "table") return lines.flatMap((line, sourceRow) => {
      const bufferRow = selectableBufferRow(region, sourceRow, line, visibleLines);
      return !line.trim() || tableSeparator.test(line) || bufferRow === null ? [] : [{
        id: `${region.id}:row:${sourceRow}`,
        kind: "table" as const,
        text: line,
        turnId: region.turnId,
        bufferRow,
      }];
    });
    const starts = lines.flatMap((line, sourceRow) => listItem.test(line) ? [sourceRow] : []);
    return starts.flatMap((sourceRow, index): StructuredSelectable[] => {
      const end = starts[index + 1] ?? lines.length;
      const bufferRow = selectableBufferRow(region, sourceRow, lines[sourceRow], visibleLines);
      if (bufferRow === null) return [];
      return [{
        id: `${region.id}:item:${sourceRow}`,
        kind: "list" as const,
        text: lines.slice(sourceRow, end).join("\n"),
        turnId: region.turnId,
        bufferRow,
      }];
    });
  }));
}

/// What one paint measured, handed to the hover checkbox and the annotation
/// marks so every gutter tenant lands on the rows the checkboxes landed on.
export type GutterPaint = {
  geometry: TerminalRowGeometry;
  /// Turn spans already slid by whatever scrollback trimmed since the scan.
  turns: VisibleTurn[];
  lines: VisibleTerminalLine[];
};
