import type { HarnessId, BoopTurn } from "./0_types.js";

export type OmpTurnSources = {
  direct: BoopTurn[];
  candidates: BoopTurn[];
};

// OMP's coordinator route is the only authority that binds its tmux pane to a
// transcript. A missing or stale route session has no safe cwd or text fallback.
export function projectionTurnSources(
  harness: HarnessId | null,
  boundSession: string | null,
  paneTurns: BoopTurn[],
  tabTurns: BoopTurn[],
  candidates: BoopTurn[],
): OmpTurnSources {
  if (harness !== "omp") return {
    direct: boundSession ? paneTurns : tabTurns,
    candidates,
  };
  return {
    direct: boundSession ? paneTurns : [],
    candidates: [],
  };
}
