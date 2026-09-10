// LogTape is an optional peer, so nothing here may import it statically. Every call site reads
// `LOG.on` first and does no other work when false: a 100k-row sort must not pay to be explainable.

// @no-features: the timing surface. It measures stages the other modules own, and each of those is tagged at its own stage

export type LogFields = Record<string, unknown>

// Structured only. Callers pass a template plus fields, never a pre-formatted line.
export type LogEmit = (
  category: readonly string[],
  message: string,
  fields: LogFields,
) => void

const noop: LogEmit = () => {}

export const LOG: { on: boolean; emit: LogEmit } = { on: false, emit: noop }

// Module constants so a hot path never allocates a category array.
export const CAT_PLAN = ["signal-grid", "plan"] as const
export const CAT_FRAME = ["signal-grid", "frame"] as const
export const CAT_DOM = ["signal-grid", "dom"] as const
export const CAT_SORT = ["signal-grid", "sort"] as const
export const CAT_GROUP = ["signal-grid", "group"] as const
export const CAT_FLATTEN = ["signal-grid", "flatten"] as const
export const CAT_INTENT = ["signal-grid", "intent"] as const

// Raw sink, so a panel can count records without paying for LogTape formatting, and without
// LogTape installed at all.
export function setGridLogEmit(emit: LogEmit | null): void {
  LOG.emit = emit ?? noop
  LOG.on = emit !== null
}

export function isGridLogging(): boolean {
  return LOG.on
}

// A logger per category is cached because `getLogger` walks the category tree on every call.
export async function enableGridLogTape(): Promise<void> {
  const { getLogger } = await import("@logtape/logtape")
  const cache = new Map<string, ReturnType<typeof getLogger>>()

  setGridLogEmit((category, message, fields) => {
    const key = category.join(".")
    let logger = cache.get(key)
    if (!logger) {
      logger = getLogger(category as unknown as string[])
      cache.set(key, logger)
    }
    logger.debug(message, fields)
  })
}

export function disableGridLogging(): void {
  setGridLogEmit(null)
}
