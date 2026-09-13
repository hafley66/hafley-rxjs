// LogTape is an optional peer, so nothing here may import it statically. Every call site reads
// `LOG.on` first and does no other work when false: a 100k-row sort must not pay to be explainable.
// The shell moved to `@hafley66/trace`; this file is the grid-shaped surface over it.

// @no-features: the timing surface. It measures stages the other modules own, and each of those is tagged at its own stage

import { emitter, logtapeEmit, setEmit } from "@hafley66/trace"
import type { Emitter, LogEmit, LogFields } from "@hafley66/trace"

export type { LogEmit, LogFields }

export const LOG: Emitter = emitter("signal-grid")

// Module constants so a hot path never allocates a category array.
export const CAT_PLAN = ["signal-grid", "plan"] as const
export const CAT_FRAME = ["signal-grid", "frame"] as const
export const CAT_DOM = ["signal-grid", "dom"] as const
// The custom property write pass. Its own stage because it is the one pass that scales with what
// the consumer declared rather than with what the window drew, which is how it hid a 449 kB style
// attribute rewalked at 240 px per frame behind a `frame` timer that read 2.5 ms.
export const CAT_VARS = ["signal-grid", "vars"] as const
// The half of a plan the scroll position does not reach. Timed apart from `plan` so a memoized base
// reads as a stage that stopped running, rather than as a stage that got faster.
export const CAT_BASE = ["signal-grid", "base"] as const
export const CAT_SORT = ["signal-grid", "sort"] as const
export const CAT_GROUP = ["signal-grid", "group"] as const
export const CAT_FLATTEN = ["signal-grid", "flatten"] as const
export const CAT_INTENT = ["signal-grid", "intent"] as const

// Raw sink, so a panel can count records without paying for LogTape formatting, and without
// LogTape installed at all.
export function setGridLogEmit(emit: LogEmit | null): void {
  setEmit(LOG, emit)
}

export function isGridLogging(): boolean {
  return LOG.on
}

export async function enableGridLogTape(): Promise<void> {
  setEmit(LOG, await logtapeEmit())
}

export function disableGridLogging(): void {
  setEmit(LOG, null)
}
