// A string typed into an editor has no module loader, so sucrase lowers each `import` to
// `require(specifier)` and this table answers it with the copy the page already holds.
import type { Example } from "./0_types.ts"

/** Answers one `require` call from an edited demo. */
export type Require = (specifier: string) => unknown

export interface Evaluated {
  readonly exports: Readonly<Record<string, unknown>>
  /** Ends every timer, frame, and window listener the edited module opened under a bare name. */
  readonly close: () => void
}

export interface Embeds {
  /** Every specifier a demo may import, other than its own `?raw` text. */
  readonly specifiers: readonly string[]
  readonly requireFor: (source: string) => Require
  readonly evaluate: (code: string, source: string) => Evaluated
}

/** The one `Example` an edited module exports, so no reader has to name which export to mount. */
export const exampleOf = (exports: Readonly<Record<string, unknown>>): Example | undefined =>
  Object.values(exports).find(isExample)

const isExample = (value: unknown): value is Example =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Example).id === "string" &&
  typeof (value as Example).mount === "function"

/** Binds the modules one site's demos may import. Everything else throws with the list in the message. */
export function createEmbeds(modules: Readonly<Record<string, unknown>>): Embeds {
  const specifiers = Object.keys(modules)

  const requireFor = (source: string): Require => {
    // Sucrase's interop reads `__esModule` before it takes `.default`, so the editor's current text
    // has to arrive dressed as a module rather than as a bare string.
    const self = { __esModule: true, default: source }
    return (specifier) => {
      if (specifier.endsWith("?raw")) return self
      const found = modules[specifier]
      if (found === undefined) {
        throw new Error(`A demo cannot import "${specifier}". The page holds ${specifiers.join(", ")}.`)
      }
      return found
    }
  }

  /** Shadows the four ambient names a runaway edit reaches for, so `close()` ends what it opened. */
  const evaluate = (code: string, source: string): Evaluated => {
    const timeouts = new Set<number>()
    const intervals = new Set<number>()
    const frames = new Set<number>()
    const listeners: { type: string; handler: EventListenerOrEventListenerObject }[] = []

    const trackedSetTimeout = (handler: TimerHandler, delay?: number, ...rest: unknown[]): number => {
      const id = window.setTimeout(handler, delay, ...rest)
      timeouts.add(id)
      return id
    }
    const trackedSetInterval = (handler: TimerHandler, delay?: number, ...rest: unknown[]): number => {
      const id = window.setInterval(handler, delay, ...rest)
      intervals.add(id)
      return id
    }
    const trackedRequestAnimationFrame = (callback: FrameRequestCallback): number => {
      const id = window.requestAnimationFrame(callback)
      frames.add(id)
      return id
    }
    const trackedAddEventListener = (
      type: string,
      handler: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ): void => {
      window.addEventListener(type, handler, options)
      listeners.push({ type, handler })
    }

    const exports: Record<string, unknown> = {}
    const body = new Function(
      "require",
      "exports",
      "module",
      "setTimeout",
      "setInterval",
      "requestAnimationFrame",
      "addEventListener",
      code,
    )
    body(
      requireFor(source),
      exports,
      { exports },
      trackedSetTimeout,
      trackedSetInterval,
      trackedRequestAnimationFrame,
      trackedAddEventListener,
    )

    const close = (): void => {
      for (const id of timeouts) window.clearTimeout(id)
      for (const id of intervals) window.clearInterval(id)
      for (const id of frames) window.cancelAnimationFrame(id)
      for (const listener of listeners) window.removeEventListener(listener.type, listener.handler)
      timeouts.clear()
      intervals.clear()
      frames.clear()
      listeners.length = 0
    }

    return { exports, close }
  }

  return { specifiers, requireFor, evaluate }
}
