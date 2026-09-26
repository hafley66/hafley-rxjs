import type { ProjectedTurnRegion } from "./0_turnRegions.js";

export type HarnessId = "claude" | "opencode" | "codex" | "kimi" | "omp";

export type LogicalLine = { text: string; start: number; end: number };

export type BoopTurn = {
  session: string;
  harness: string;
  turn: number;
  ts: number;
  role: string;
  said: string;
  session_scope?: "root" | "child" | "unknown";
  parent_session?: string | null;
};

export type VisibleTurn = BoopTurn & {
  id: string;
  bufferStart: number;
  bufferEnd: number;
  anchorStart: number;
  anchorEnd: number;
  regions: ProjectedTurnRegion[];
  confidence: "anchored" | "extended";
  source: "xterm+boop" | "xterm+tmux+boop";
  clippedAbove?: boolean;
  clippedBelow?: boolean;
};
