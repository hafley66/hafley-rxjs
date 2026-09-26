import type { VisibleTerminalLine } from "./3_ports.js";
import { gutter_offset_px } from "./1_contextGutterPure.js";
export { gutter_offset_px } from "./1_contextGutterPure.js";

/// The queue id a hover-taken line carries; one per logical line, so a second
/// click on the same line unchecks rather than queues a duplicate.
export const hoverLineId = (line: VisibleTerminalLine) => `line:${line.id}`;

/// The logical line a hover checkbox on `bufferRow` would queue. A blank line
/// queues nothing, so no checkbox is offered for it.
export function hoverTargetAt(lines: VisibleTerminalLine[], bufferRow: number): VisibleTerminalLine | null {
  const line = lines.find((candidate) => candidate.bufferStart <= bufferRow && bufferRow <= candidate.bufferEnd);
  return line && line.text.trim() ? line : null;
}

/// The screen row under a pointer, by geometry rather than by hit target:
/// xterm stacks selection, decoration and helper layers over its row
/// elements, so the element under the mouse is rarely the row itself.
export function screenRowAt(
  screen: { top: number; bottom: number; left: number; right: number; height: number },
  rows: number,
  x: number,
  y: number,
): number | null {
  if (rows <= 0 || y < screen.top || y >= screen.bottom) return null;
  if (x >= screen.right || x < screen.left - gutter_offset_px - 6) return null;
  return Math.min(rows - 1, Math.floor((y - screen.top) / (screen.height / rows)));
}
