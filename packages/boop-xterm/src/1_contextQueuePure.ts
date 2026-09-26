import type { VisibleTurn } from "./0_types.js";

export type PromptContextItem = {
  id: string;
  /// `selection`: a range the reader picked; `table`/`list`/`heading`: a
  /// structured row taken by its gutter checkbox; `line`: one logical line
  /// taken by the hover checkbox.
  kind: "selection" | "table" | "list" | "heading" | "line";
  /// The slice taken off the screen. Held as read, so the quote in the prompt
  /// is what the turn actually said.
  text: string;
  /// What the reader wants done with the slice. Kept apart from `text` so the
  /// intent is never mistaken for the quote by whoever reads the prompt.
  note?: string;
  turnIds: string[];
  enabled: boolean;
};

export type TerminalSelectionSnapshot = {
  text: string;
  bufferStart: { row: number; col: number };
  bufferEnd: { row: number; col: number };
  turnIds: string[];
};

export function formatQueuedContext(items: PromptContextItem[]): string {
  const selected = items.filter((item) => item.enabled && item.text.trim());
  if (!selected.length) return "";
  return `Selected context:\n\n${selected.map((item) => {
    const source = item.turnIds.length ? `turn ${item.turnIds.join(", ")}` : "terminal selection";
    const note = item.note?.trim();
    // The note is the reader's intent for the slice, so it goes under the quote
    // and says which it is; a slice with no note reads exactly as it used to.
    return note
      ? `[${source}]\n${item.text.trim()}\n\nAbout that: ${note}`
      : `[${source}]\n${item.text.trim()}`;
  }).join("\n\n")}\n\n`;
}

// Tags a selection with the turns whose own text it overlaps, never with a
// turn whose extended span merely reaches across it. Role-blind on purpose:
// a user turn is as quotable as an assistant one.
export function turnsAcrossRange(turns: VisibleTurn[], start: number, end: number): string[] {
  return turns
    .filter((turn) => turn.anchorEnd >= start && turn.anchorStart <= end)
    .map((turn) => turn.id);
}

