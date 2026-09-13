// How a parent hands its `Key` to the thing it starts, one channel per runtime. Each channel is
// written by the parent and read by `ident()` in the child before any other source of `parent`, so
// a child always learns who started it as a full `pid@born` key rather than a bare pid.
import type { Edge, EdgeCause, Ident } from "./0_types.js"
import { key, parentKey } from "./1_ident.js"

export const ENV_PARENT = "HAFLEY_TRACE_PARENT"

/** Merge into `env` of `child_process.spawn`. No node import, so a browser bundle can hold it. */
export function childEnv(id: Ident): Readonly<Record<string, string>> {
  return { [ENV_PARENT]: key(id) }
}

/** Replaces `workerName(parentPid, service)`. Same wire format, the pid part is now the key. */
export function workerName(id: Ident, service: string): string {
  return `hafley:${key(id)}:${service}`
}

/** The edge row a child can state about itself, or undefined when it has no known parent. */
export function edge(child: Ident, cause: EdgeCause): Edge | undefined {
  const parent = parentKey(child)
  if (parent === undefined) return undefined
  return { child: key(child), parent, since: Math.round(child.born), until: undefined, cause }
}
