import type { PromptContextItem } from "./1_contextQueuePure.js";

export type BoopTurnCommentTarget = {
  session: string;
  turn: number;
  role: string;
  /// The assistant turn that answered a sent comment; absent while pending.
  replyTurn?: number | null;
};

export type BoopTurnComment = {
  commentId: number;
  clientId: string;
  kind: PromptContextItem["kind"];
  quote: string;
  note: string | null;
  enabled: boolean;
  tabName: string | null;
  targets: BoopTurnCommentTarget[];
  createdTs: number;
  updatedTs: number;
};

export type BoopTurnCommentForkReply = {
  session: string;
  turn: number;
  said: string;
};

export type BoopTurnCommentFork = {
  commentId: number;
  lane: string;
  branch: string;
  brief: string;
  createdTs: number;
  state: "running" | "done" | "dead";
  rc: number | null;
  reply: BoopTurnCommentForkReply | null;
  /// The lane's tmux target, resolved to the lane name until it registers one.
  tmux: string;
};

/// The fields whose change rewrites a row, held by value because the queue
/// mutates items in place and a kept reference always compares equal to itself.
export type SyncedShape = { text: string; note: string; enabled: boolean; turns: string };

export function shapeOf(item: PromptContextItem): SyncedShape {
  return {
    text: item.text,
    note: item.note ?? "",
    enabled: item.enabled,
    turns: item.turnIds.join("\u0000"),
  };
}

/// Whether a stored row may appear on a tab. The owning tab always sees it;
/// any other tab sees it only while the terminal is showing one of the turns
/// it targets. Matching on session alone bled the queue panel onto every
/// same-cwd tab, including ones never focused on those turns.
export function rowShowsOn(
  row: BoopTurnComment,
  tabName: string,
  visibleTurnIds: ReadonlySet<string>,
): boolean {
  if (row.tabName === tabName) return true;
  return row.targets.some((target) => visibleTurnIds.has(`${target.session}:${target.turn}`));
}

/// `session` may itself contain ':'; the turn number never does.
export function splitTurnId(id: string): { session: string; turn: number } | null {
  const at = id.lastIndexOf(":");
  if (at <= 0) return null;
  const turn = Number(id.slice(at + 1));
  return Number.isInteger(turn) ? { session: id.slice(0, at), turn } : null;
}

export function toComment(item: PromptContextItem, tabName: string): BoopTurnComment {
  return {
    commentId: 0,
    clientId: item.id,
    kind: item.kind,
    quote: item.text,
    note: item.note?.trim() ? item.note : null,
    enabled: item.enabled,
    tabName,
    targets: item.turnIds.flatMap((id) => {
      const target = splitTurnId(id);
      return target ? [{ ...target, role: "" }] : [];
    }),
    createdTs: 0,
    updatedTs: 0,
  };
}

export function toItem(comment: BoopTurnComment): PromptContextItem {
  return {
    id: comment.clientId,
    kind: comment.kind,
    text: comment.quote,
    note: comment.note ?? undefined,
    turnIds: comment.targets.map((target) => `${target.session}:${target.turn}`),
    enabled: comment.enabled,
  };
}

export function diffItems(
  last: Map<string, SyncedShape>,
  next: PromptContextItem[],
): { upserts: PromptContextItem[]; removals: string[] } {
  const seen = new Set(next.map((item) => item.id));
  const upserts = next.filter((item) => {
    const prev = last.get(item.id);
    const shape = shapeOf(item);
    return !prev
      || prev.text !== shape.text
      || prev.note !== shape.note
      || prev.enabled !== shape.enabled
      || prev.turns !== shape.turns;
  });
  const removals = [...last.keys()].filter((id) => !seen.has(id));
  return { upserts, removals };
}

