import type { Terminal } from "@xterm/xterm";

export type SelectionCell = { row: number; col: number };
export type PinnedSelection = { anchor: SelectionCell; focus: SelectionCell };
export type PinnedRowSpan = { row: number; startCol: number; endCol: number };

// Anchor and focus in the order the buffer reads them (top-left first).
export function orderedSelection(selection: PinnedSelection): PinnedSelection {
  const { anchor, focus } = selection;
  const reversed = focus.row < anchor.row || (focus.row === anchor.row && focus.col < anchor.col);
  return reversed ? { anchor: focus, focus: anchor } : selection;
}

// One half-open [startCol, endCol) span per buffer row the selection covers,
// with interior rows running the full width. Both cells name the character
// under the pointer, so the last row reads one column past its focus.
export function pinnedRowSpans(selection: PinnedSelection, cols: number): PinnedRowSpan[] {
  const { anchor, focus } = orderedSelection(selection);
  const spans: PinnedRowSpan[] = [];
  for (let row = anchor.row; row <= focus.row; row++) {
    const startCol = row === anchor.row ? anchor.col : 0;
    const endCol = row === focus.row ? Math.min(cols, focus.col + 1) : cols;
    if (endCol > startCol) spans.push({ row, startCol, endCol });
  }
  return spans;
}

// xterm's own default (ITerminalOptions.wordSeparator). Matching it keeps a
// double-click on a codex pane picking the same word it would on a plain one.
const WORD_SEPARATORS = " ()[]{}',\"`";

/// The word under `col` as a half-open [startCol, endCol), or null when the
/// cell itself is a separator so there is no word to take.
export function wordSpanAt(text: string, col: number): { startCol: number; endCol: number } | null {
  if (col < 0 || col >= text.length) return null;
  if (WORD_SEPARATORS.includes(text[col])) return null;
  let startCol = col;
  let endCol = col + 1;
  while (startCol > 0 && !WORD_SEPARATORS.includes(text[startCol - 1])) startCol--;
  while (endCol < text.length && !WORD_SEPARATORS.includes(text[endCol])) endCol++;
  return { startCol, endCol };
}

/// The row's text without its trailing blanks, or null for a blank row.
export function lineSpanAt(text: string): { startCol: number; endCol: number } | null {
  const endCol = text.replace(/\s+$/, "").length;
  return endCol > 0 ? { startCol: 0, endCol } : null;
}

// A press with no travel is a click, so the caller can leave it to the pane.
export function isEmptySelection(selection: PinnedSelection): boolean {
  const { anchor, focus } = selection;
  return anchor.row === focus.row && anchor.col === focus.col;
}

// Rows join with \n, and each row is right-trimmed the way xterm's own
// getSelection does, so a copied block has no trailing padding.
export function joinPinnedRows(rows: string[]): string {
  return rows.map((row) => row.replace(/\s+$/, "")).join("\n");
}

