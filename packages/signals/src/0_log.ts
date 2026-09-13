// LogTape is an optional peer, so nothing here may import it statically. Every call site reads
// `LOG.on` first and does no other work when false: a 50k-row write must not pay to be explainable.
// The shell moved to `@hafley66/trace`; this file is the signals-shaped surface over it.
import { emitter, logtapeEmit, setEmit } from "@hafley66/trace"
import type { Emitter, LogEmit, LogFields } from "@hafley66/trace"

export type { LogEmit, LogFields }

export const LOG: Emitter = emitter("signals")

// Module constants so a hot path never allocates a category array.
export const CAT_WRITE = ["signals", "write"] as const
export const CAT_EMIT = ["signals", "emit"] as const
export const CAT_SELECTOR = ["signals", "selector"] as const
export const CAT_COMPUTE = ["signals", "compute"] as const
export const CAT_INVALIDATE = ["signals", "invalidate"] as const
export const CAT_SUBSCRIBE = ["signals", "subscribe"] as const
export const CAT_UNSUBSCRIBE = ["signals", "unsubscribe"] as const

// Raw sink, so a benchmark can count records without paying for LogTape formatting.
export function setSignalLogEmit(emit: LogEmit | null): void {
  setEmit(LOG, emit)
}

export function isSignalLogging(): boolean {
  return LOG.on
}

export async function enableSignalLogTape(): Promise<void> {
  setEmit(LOG, await logtapeEmit())
}

export function disableSignalLogging(): void {
  setEmit(LOG, null)
}
