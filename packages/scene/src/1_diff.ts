import type { Diff, Id } from "./0_types"

const EMPTY: readonly Id[] = Object.freeze([])

/** Keyed set difference. O(|prev| + |next|). Order follows `next` for keep/enter and `prev` for exit. */
export function diff(prev: Iterable<Id> | null | undefined, next: Iterable<Id> | null | undefined): Diff {
  const before = new Set(prev ?? EMPTY)
  const keep: Id[] = []
  const enter: Id[] = []
  const seen = new Set<Id>()
  for (const id of next ?? EMPTY) {
    seen.add(id)
    if (before.has(id)) keep.push(id)
    else enter.push(id)
  }
  const exit: Id[] = []
  for (const id of before) if (!seen.has(id)) exit.push(id)
  return { keep, enter, exit }
}

export const NO_DIFF: Diff = Object.freeze({ keep: EMPTY, enter: EMPTY, exit: EMPTY })

/** A diff where everything enters: the first frame. */
export const enterAll = (ids: readonly Id[]): Diff => ({ keep: EMPTY, enter: ids, exit: EMPTY })
