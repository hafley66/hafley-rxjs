// The shell `signals/src/0_log.ts` and `signal-grid/src/0_log.ts` both carry. Diffed with package
// names normalised the two files differ by eighteen lines, every one a comment.
import type { Emitter, Ident, LogEmit, LogFields } from "./0_types.js"
import { ident } from "./1_ident.js"

const noop: LogEmit = () => {}

let who: Ident | null = null

/** The identity every emitter stamps onto its records. Resolved once, lazily, because a browser
 * tab has to reach `sessionStorage` and a module's top level is too early in a worker. */
export function self_(over?: Partial<Ident>): Ident {
  if (who === null || over !== undefined) who = ident(over)
  return who
}

export function emitter(pkg: string): Emitter {
  return { pkg, on: false, emit: noop }
}

/** Point an emitter at a sink. `null` turns it off and restores the no-op, so the check in a hot
 * loop is one boolean read. */
export function setEmit(target: Emitter, emit: LogEmit | null): void {
  target.emit = emit ?? noop
  target.on = emit !== null
}

/**
 * Wrap a sink so every record carries the identity. The fields go on each record rather than on a
 * resource, because the raw sink has no resource to hang them from.
 */
export function stamped(emit: LogEmit, over?: Partial<Ident>): LogEmit {
  const id = self_(over)
  return (category, message, fields) =>
    emit(category, message, { ...fields, pid: id.pid, parent: id.parent, service: id.service, instance: id.instance })
}

/** A console sink, prefixed. `grid/browser:0bfcc223 signal-grid.dom wrote 33 rows`. */
export function consoleEmit(over?: Partial<Ident>): LogEmit {
  const id = self_(over)
  return (category, message, fields: LogFields) => {
    console.debug(`${id.prefix} ${category.join(".")} ${message}`, fields)
  }
}
