import { rowOnScreen, rowTop, type TerminalRowGeometry } from "./1_rowGeometry.js";
import type { BoopTurnCommentFork } from "./2_contextSyncPure.js";
import type { PlacedAnnotation } from "./3_turnMarksPure.js";
import { FORK_PRESET, wrapText, type PlacedFork } from "./4_forkMarks.js";

/// Which shape a fork draws in: the overlay on the mark row, or a child pane
/// bound to the lane's tmux session.
export type ForkShape = "overlay" | "pane";

export function forkShape(livePane: boolean): ForkShape {
  return livePane ? "pane" : "overlay";
}

/// One element per `(comment_id, lane)`, the same key the fork table holds.
export function forkKey(fork: BoopTurnCommentFork): string {
  return `${fork.commentId}:${fork.lane}`;
}

/// Fork rows carry seconds on lanes registered before the ms columns landed.
function createdMs(createdTs: number): number {
  return createdTs > 0 && createdTs < 1e12 ? createdTs * 1000 : createdTs;
}

export function forkAge(createdTs: number, nowMs: number): string {
  const created = createdMs(createdTs);
  if (!created) return "";
  const seconds = Math.max(0, Math.floor((nowMs - created) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m${String(seconds % 60).padStart(2, "0")}s`;
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}m`;
}

/// The collapsed line: the disclosure arrow, the lane, its preset, its state
/// with rc when the lane finished, and how long ago it was forked.
export function forkHeaderText(fork: BoopTurnCommentFork, expanded: boolean, nowMs: number): string {
  const rc = fork.rc == null ? "" : ` rc=${fork.rc}`;
  const age = forkAge(fork.createdTs, nowMs);
  return [`${expanded ? "▾" : "▸"} ${fork.lane}`, FORK_PRESET, `${fork.state}${rc}`, age]
    .filter((part) => part.length)
    .join("  ");
}

/// The expanded body: the lane's reply wrapped to `cols`, then the brief it
/// read. A running lane has no reply yet, so the body is the brief alone.
export function forkBodyLines(fork: BoopTurnCommentFork, cols: number): string[] {
  const width = Math.max(20, cols - 2);
  const lines = fork.reply ? wrapText(fork.reply.said, width).map((line) => `│ ${line}`) : [];
  return [...lines, `└ ${fork.branch}  ${fork.brief}`];
}

/// How far right of the cell grid's left edge a child pane starts: the mock's
/// four-column indent at instant's cell width.
export const fork_indent_px = 26;
/// A child pane's height in terminal rows.
export const fork_pane_rows = 8;

export type ForkPlacement = {
  key: string;
  /// The row the fork draws under: the comment's mark row plus one.
  bufferRow: number;
  top: number;
  left: number;
  right: number;
  onScreen: boolean;
};

export function placeForkOverlays(
  geometry: TerminalRowGeometry,
  forks: PlacedFork[],
): ForkPlacement[] {
  return forks.map((fork) => {
    const bufferRow = fork.bufferRow + 1;
    return {
      key: forkKey(fork.fork),
      bufferRow,
      top: rowTop(geometry, bufferRow),
      left: geometry.left,
      right: geometry.right,
      onScreen: rowOnScreen(geometry, bufferRow),
    };
  });
}

export type ForkPanePlacement = ForkPlacement & {
  height: number;
  /// Pixels this pane sits below its anchor row because the pane above it ends
  /// there; the spacer the stack had to absorb.
  spacer: number;
};

/// Each pane starts at its own row or at the bottom of the pane above it,
/// whichever is lower, so two forks close together never draw on top of each other.
export function placeForkPanes(
  geometry: TerminalRowGeometry,
  forks: PlacedFork[],
  paneRows = fork_pane_rows,
): ForkPanePlacement[] {
  const height = paneRows * geometry.cellHeight;
  const sorted = [...forks].sort((left, right) => left.bufferRow - right.bufferRow);
  let bottom = Number.NEGATIVE_INFINITY;
  return sorted.map((fork) => {
    const bufferRow = fork.bufferRow + 1;
    const anchor = rowTop(geometry, bufferRow);
    const top = Math.max(anchor, bottom);
    bottom = top + height;
    return {
      key: forkKey(fork.fork),
      bufferRow,
      top,
      left: geometry.left + fork_indent_px,
      right: geometry.right,
      onScreen: rowOnScreen(geometry, bufferRow),
      height,
      spacer: top - anchor,
    };
  });
}

/// The last `rows` non-empty-tail lines of a tmux capture, what a fixed-height
/// child pane shows of a lane that has scrolled past it.
export function tailLines(capture: string, rows: number): string[] {
  const lines = capture.replace(/\s+$/, "").split("\n");
  return lines.slice(Math.max(0, lines.length - rows));
}

/// `boop beep fork` is the one verb that opens a lane off a stored comment; a
/// comment the store has never seen has id 0 and cannot be forked.
export function forkCommand(commentId: number, preset: string): string {
  return `boop beep fork ${commentId} --preset ${preset} --interactive`;
}

/// The presets a fork is offered on, off `boop config presets`.
export const FORK_PRESETS = ["flash4", "pro4", "opus"] as const;
export type ForkPreset = (typeof FORK_PRESETS)[number];

/// A selection's own comment row id, keyed by what was selected rather than by
/// the clock, so forking the same text twice reuses one comment row.
export function selectionClientId(tabName: string, text: string, turnIds: string[]): string {
  const seed = `${tabName}\u0000${turnIds.join(",")}\u0000${text}`;
  let hash = 5381;
  for (let index = 0; index < seed.length; index++) hash = ((hash * 33) ^ seed.charCodeAt(index)) >>> 0;
  return `fork-selection:${hash.toString(36)}`;
}

/// `boop beep fork` prints `forked comment 47 -> lane fork-comment-47`; the
/// toast names the lane it printed, or the one the branch rule predicts.
/// The lane `boop beep fork` names in its last line, `forked comment N -> lane X`;
/// null when the output carries no such line, which is a failed spawn.
export function forkedLane(stdout: string): string | null {
  const named = /->\s*lane\s+(\S+)/.exec(stdout);
  return named ? named[1] : null;
}

export type ForkTarget = { commentId: number; label: string };

export function forkMenuTargets(entries: PlacedAnnotation[]): ForkTarget[] {
  const seen = new Set<number>();
  const targets: ForkTarget[] = [];
  for (const { comment } of entries) {
    if (comment.commentId <= 0 || seen.has(comment.commentId)) continue;
    seen.add(comment.commentId);
    const quote = comment.quote.split("\n").find((line) => line.trim())?.trim() ?? "";
    targets.push({
      commentId: comment.commentId,
      label: comment.note?.trim() || quote.slice(0, 48) || `comment ${comment.commentId}`,
    });
  }
  return targets;
}


/// How long a child pane's capture stays fresh.
export const fork_capture_ms = 1_200;
