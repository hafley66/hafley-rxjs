// A string typed into an editor has no module loader, so sucrase lowers each `import` to
// `require(specifier)` and this table answers it with the copy the page already holds.
import { Signal } from "@hafley66/signals"
import * as rxjs from "rxjs"
import type { Example } from "../examples/0_types.js"
import * as signalGrid from "../src/index.js"

/** Answers one `require` call from an edited demo. */
export type Require = (specifier: string) => unknown

const MODULES: Readonly<Record<string, unknown>> = {
  "../src/index.js": signalGrid,
  "@hafley66/signals": { Signal },
  rxjs,
}

/** Every specifier a demo may import, other than its own `?raw` text. */
export const EMBEDS: readonly string[] = Object.keys(MODULES)

export function requireFor(source: string): Require {
  // Sucrase's interop reads `__esModule` before it takes `.default`, so the editor's current text
  // has to arrive dressed as a module rather than as a bare string.
  const self = { __esModule: true, default: source }
  return (specifier) => {
    if (specifier.endsWith("?raw")) return self
    const found = MODULES[specifier]
    if (found === undefined) {
      throw new Error(`A demo cannot import "${specifier}". The page holds ${EMBEDS.join(", ")}.`)
    }
    return found
  }
}

export interface Evaluated {
  readonly exports: Readonly<Record<string, unknown>>
  /** Ends every timer, frame, and window listener the edited module opened under a bare name. */
  readonly close: () => void
}

/** Shadows the four ambient names a runaway edit reaches for, so `close()` ends what it opened. */
export function evaluate(code: string, source: string): Evaluated {
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

const isExample = (value: unknown): value is Example =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Example).id === "string" &&
  typeof (value as Example).mount === "function"

/** The one `Example` an edited module exports, so no reader has to name which export to mount. */
export const exampleOf = (exports: Readonly<Record<string, unknown>>): Example | undefined =>
  Object.values(exports).find(isExample)
