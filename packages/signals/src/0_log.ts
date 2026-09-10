// LogTape is an optional peer, so nothing here may import it statically. Every call site reads
// `LOG.on` first and does no other work when false: a 50k-row write must not pay to be explainable.

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
export const CAT_WRITE = ["signals", "write"] as const
export const CAT_EMIT = ["signals", "emit"] as const
export const CAT_SELECTOR = ["signals", "selector"] as const
export const CAT_COMPUTE = ["signals", "compute"] as const
export const CAT_INVALIDATE = ["signals", "invalidate"] as const
export const CAT_SUBSCRIBE = ["signals", "subscribe"] as const
export const CAT_UNSUBSCRIBE = ["signals", "unsubscribe"] as const

// Raw sink, so a benchmark can count records without paying for LogTape formatting.
export function setSignalLogEmit(emit: LogEmit | null): void {
  LOG.emit = emit ?? noop
  LOG.on = emit !== null
}

export function isSignalLogging(): boolean {
  return LOG.on
}

// A logger per category is cached because `getLogger` walks the category tree on every call.
export async function enableSignalLogTape(): Promise<void> {
  const { getLogger } = await import("@logtape/logtape")
  const cache = new Map<string, ReturnType<typeof getLogger>>()

  setSignalLogEmit((category, message, fields) => {
    const key = category.join(".")
    let logger = cache.get(key)
    if (!logger) {
      logger = getLogger(category as unknown as string[])
      cache.set(key, logger)
    }
    logger.debug(message, fields)
  })
}

export function disableSignalLogging(): void {
  setSignalLogEmit(null)
}
