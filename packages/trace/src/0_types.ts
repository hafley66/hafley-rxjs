// @comment-ok: the identity model is the deliverable of this package, and each field names the OTel
// resource attribute it prints to, which is the only reason the field exists
//
// One relational key for a running thing, whatever runtime it is in. The names follow OpenTelemetry
// resource semantic conventions so `resource()` is a rename and nothing else.
//
// | field | attribute | node | browser |
// | service | service.name | you | you |
// | namespace | service.namespace | you | you |
// | instance | service.instance.id | uuid per process | uuid per tab |
// | pid | process.pid | process.pid | the tab id |
// | parent | process.parent_pid | process.ppid | the opener's tab id, or the worker's host |
// | runtime | process.runtime.name | nodejs, bun, deno | browser, worker |
// | born | process.creation.time | process start | performance.timeOrigin |

export type Runtime = "nodejs" | "bun" | "deno" | "browser" | "worker" | "unknown"

export interface Ident {
  readonly service: string
  readonly namespace: string | undefined
  readonly instance: string
  readonly pid: string
  readonly parent: string | undefined
  /** The parent's `born`, when a handoff carried it. Together with `parent` it forms the parent `Key`. */
  readonly parentBorn: number | undefined
  readonly runtime: Runtime
  readonly version: string | undefined
  readonly born: number
  /** A short human prefix for a console line: `grid/browser:0bfcc223`. */
  readonly prefix: string
}

/** `${pid}@${Math.round(born)}`. A pid is reused; a pid at an instant is not. */
export type Key = string

export interface Death {
  readonly at: number
  /** `reported`: the process said so (exit, pagehide). `timeout`: a reader stopped hearing it. */
  readonly how: "reported" | "timeout"
}

export interface Span {
  readonly key: Key
  readonly ident: Ident
  readonly born: number
  readonly died: Death | undefined
  /** Wall clock of the last record seen from this span. The reaper reads it. */
  readonly seen: number
}

export type EdgeCause = "spawn" | "open" | "attach" | "reparent" | "orphan"

export interface Edge {
  readonly child: Key
  readonly parent: Key
  readonly since: number
  readonly until: number | undefined
  readonly cause: EdgeCause
}

export type LogFields = Record<string, unknown>

export type LogEmit = (
  category: readonly string[],
  message: string,
  fields: LogFields,
) => void

/**
 * The shell every instrumented package copies today. `on` is checked first and no other work
 * happens when it is false, so a hot loop does not pay to be explainable.
 */
export interface Emitter {
  readonly pkg: string
  on: boolean
  emit: LogEmit
}

export type LagKind = "raf" | "timeout" | "eventloop"

/** One window of scheduling delay. `expected` is what the source asked for, so `p50 - expected` is
 * the lag; `worst` is the number a user feels. */
export interface Lag {
  readonly kind: LagKind
  readonly expectedMs: number
  readonly samples: number
  readonly p50: number
  readonly p95: number
  readonly worst: number
  /** Long Animation Frame totals for the window, when the runtime reports them. */
  readonly scriptMs: number | undefined
  readonly styleLayoutMs: number | undefined
  readonly blockingMs: number | undefined
  readonly heapBytes: number | undefined
}
