// A span for this runtime and the pure folds that turn a stream of span and edge rows into the
// current table. `life$` emits the runtime's own span; nothing in src subscribes to it.
import { Observable } from "rxjs"
import type { Death, Edge, Ident, Span } from "./0_types.js"
import { key, runtimeOf } from "./1_ident.js"

/** The span for this runtime. Emits once at subscribe with `died: undefined`, and once more with
 * `died: { how: "reported" }` when the runtime says it is ending: `process.once("exit")` in node,
 * `pagehide` in a browser. A worker has no such event and completes after the first emit. */
export function life$(id: Ident): Observable<Span> {
  const spanKey = key(id)
  const born = Math.round(id.born)
  return new Observable<Span>((subscriber) => {
    const make = (died: Death | undefined): Span => ({ key: spanKey, ident: id, born, died, seen: Date.now() })
    let done = false
    const finish = (): void => {
      if (done) return
      done = true
      subscriber.next(make({ at: Date.now(), how: "reported" }))
      subscriber.complete()
    }
    subscriber.next(make(undefined))
    const runtime = runtimeOf()
    if (runtime === "worker") {
      // A worker has no exit or pagehide event; the host closes it. There is no reported death, so
      // the span is complete after its first emit.
      subscriber.complete()
      return
    }
    if (runtime === "browser") {
      const onHide = (): void => finish()
      globalThis.addEventListener?.("pagehide", onHide)
      return () => globalThis.removeEventListener?.("pagehide", onHide)
    }
    const proc = (globalThis as {
      process?: { once?: (ev: string, fn: () => void) => void; removeListener?: (ev: string, fn: () => void) => void }
    }).process
    if (proc === undefined || typeof proc.once !== "function" || typeof proc.removeListener !== "function") {
      subscriber.complete()
      return
    }
    const once = proc.once.bind(proc)
    const remove = proc.removeListener.bind(proc)
    once("exit", finish)
    return () => remove("exit", finish)
  })
}

/** Pure. Every span with no `died` and `seen < now - timeoutMs` gets `died: { at: seen, how: "timeout" }`. */
export function reap(spans: readonly Span[], now: number, timeoutMs: number): Span[] {
  return spans.map((s) =>
    s.died === undefined && s.seen < now - timeoutMs
      ? { ...s, died: { at: s.seen, how: "timeout" } as Death }
      : s,
  )
}

/** Pure. Fold a stream of `Span` and `Edge` rows into the current table, last write wins per key. */
export function table(rows: readonly (Span | Edge)[]): { spans: Span[]; edges: Edge[] } {
  const spans = new Map<string, Span>()
  const edges = new Map<string, Edge>()
  for (const row of rows) {
    if ("ident" in row) spans.set(row.key, row as Span)
    else edges.set(row.child, row as Edge)
  }
  return { spans: [...spans.values()], edges: [...edges.values()] }
}

/** Pure. An edge whose parent is dead and child alive gets `until = parent.died.at`. No new edge
 * is emitted for the orphan; a renderer that wants a reparent draws it from `until`. */
export function endEdges(spans: readonly Span[], edges: readonly Edge[]): Edge[] {
  const deadAt = new Map<string, number>()
  const alive = new Set<string>()
  for (const s of spans) {
    if (s.died === undefined) alive.add(s.key)
    else deadAt.set(s.key, s.died.at)
  }
  return edges.map((e) => {
    if (e.until !== undefined) return e
    const parentDeadAt = deadAt.get(e.parent)
    if (parentDeadAt !== undefined && alive.has(e.child)) return { ...e, until: parentDeadAt }
    return e
  })
}
