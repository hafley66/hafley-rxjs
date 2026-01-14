import { Observable, tap } from "rxjs"
import originalDebug, { Debugger } from "debug"

// Cache to store debug instances by filename
const debugCache: Record<string, Debugger> = {}

// Create a proxy handler
const handler: ProxyHandler<typeof debugCache> = {
  get(target, prop: string) {
    prop = "" + prop
    if (prop.startsWith("http")) {
      try {
        prop = new URL(prop).pathname
      } catch (e) {}
    }
    // If the property is a standard method of the debug library, return it
    if (prop in target) {
      return target[prop as keyof typeof target]
    }

    if (prop.startsWith("/")) prop = prop.slice(1)

    // If it's a filename, create or return a cached debug instance
    if (typeof prop === "string") {
      if (!debugCache[prop]) {
        // Extract a reasonable namespace from the filename
        // Remove extension and convert path separators to colons
        const namespace = prop
          .replace(/\.(js|ts|jsx|tsx)$/, "")
          .replace(/[\/\\]/g, ":")

        debugCache[prop] = originalDebug(namespace)
      }
      return debugCache[prop]
    }

    return undefined
  },
}

/**
 * Proxy-based debug helper that auto-creates namespaced debug instances.
 * Uses the `debug` npm package under the hood.
 *
 * @example
 * ```ts
 * const log = debug$[import.meta.url]
 * log("something happened")  // logs with namespace derived from file path
 * ```
 */
export const debug$ = new Proxy(debugCache, handler) as Record<string, Debugger>

const _tags: Record<string, number> = {}

/**
 * Debug operator using the `debug` npm package instead of console.log.
 * Creates unique IDs per subscription for tracking.
 *
 * @example
 * ```ts
 * const log = debug$[import.meta.url]
 * source$.pipe(
 *   TAG(log, "myOp")
 * )
 * // Logs via debug: myOp/(0)/subscribe, myOp/(0)/next ...
 * ```
 *
 * @example
 * ```ts
 * // Simple string tag (uses module-level debug instance)
 * source$.pipe(TAG("myTag"))
 * ```
 */
export function TAG<T>(
  TAG_PREFIX_: string | number | Debugger,
  _TAG_PREFIX?: string | number
) {
  const TAG_PREFIX = _TAG_PREFIX ?? `${TAG_PREFIX_}`
  // If first arg is a Debugger, extend it. Otherwise create a simple log function.
  const log =
    typeof TAG_PREFIX_ === "number" || typeof TAG_PREFIX_ === "string"
      ? (...args: unknown[]) => console.log(`[${TAG_PREFIX_}]`, ...args)
      : TAG_PREFIX_.extend(`${_TAG_PREFIX ?? ""}`)

  return (source: Observable<T>): Observable<T> => {
    return new Observable<T>((sub) => {
      _tags[TAG_PREFIX] = (_tags[TAG_PREFIX] ?? -1) + 1
      const id = _tags[TAG_PREFIX]
      const s = tap<T>({
        subscribe: () => log(`(${id})/subscribe`),
        next: (n) => log(`(${id})/next`, n),
        error: (e) => log(`(${id})/error`, e),
        complete: () => log(`(${id})/complete`),
        unsubscribe: () => log(`(${id})/unsubscribe`),
        finalize: () => log(`(${id})/finalize`),
      })(source).subscribe(sub)
      return () => s.unsubscribe()
    })
  }
}
