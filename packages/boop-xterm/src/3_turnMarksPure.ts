import type { VisibleTerminalLine } from "./3_ports.js";
import type { VisibleTurn } from "./0_types.js";
import type { BoopTurnComment } from "./2_contextSyncPure.js";

/// A sent comment placed on screen: the turn it quoted and the row its quote
/// starts on.
export type PlacedAnnotation = { comment: BoopTurnComment; turn: VisibleTurn; bufferRow: number };

function normalize(line: string): string {
  return line.toLowerCase().replace(/[`_*~#|]/g, " ").replace(/\s+/g, " ").trim();
}

/// The visible row a comment's quote starts on inside `turn`, by text; the
/// turn's own first anchored row when the quote is scrolled off or reflowed
/// past recognition. `null` when nothing of the turn is on screen.
export function markRowFor(
  comment: BoopTurnComment,
  turn: Pick<VisibleTurn, "bufferStart" | "bufferEnd" | "anchorStart">,
  lines: VisibleTerminalLine[],
): number | null {
  const first = normalize(comment.quote.split("\n").find((line) => line.trim()) ?? "");
  const inTurn = lines.filter((line) => line.bufferEnd >= turn.bufferStart && line.bufferStart <= turn.bufferEnd);
  if (first.length >= 3) {
    const hit = inTurn.find((line) => normalize(line.text).includes(first));
    if (hit) return hit.bufferStart;
  }
  const fallback = inTurn.find((line) => line.bufferStart >= turn.anchorStart) ?? inTurn[0];
  return fallback ? fallback.bufferStart : null;
}

/// Every sent comment that targets a visible turn, placed on a row.
export function placeAnnotations(
  comments: BoopTurnComment[],
  turns: VisibleTurn[],
  lines: VisibleTerminalLine[],
): PlacedAnnotation[] {
  return comments.flatMap((comment) => comment.targets.flatMap((target) => {
    const turn = turns.find((candidate) => candidate.id === `${target.session}:${target.turn}`);
    if (!turn) return [];
    const bufferRow = markRowFor(comment, turn, lines);
    return bufferRow === null ? [] : [{ comment, turn, bufferRow }];
  }));
}

/// The tooltip for the marks stacked on one row: each note, its quote's first
/// line, and the turn that answered it.
export function markTitle(placed: PlacedAnnotation[]): string {
  return placed.map(({ comment, turn }) => {
    const target = comment.targets.find((candidate) => `${candidate.session}:${candidate.turn}` === turn.id);
    const reply = target?.replyTurn == null ? "reply: not ingested yet" : `reply: turn ${target.replyTurn}`;
    const quote = comment.quote.split("\n").find((line) => line.trim())?.trim() ?? "";
    return `${comment.note?.trim() || "(no note)"}\n> ${quote}\n${reply}`;
  }).join("\n\n");
}

