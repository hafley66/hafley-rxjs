import type { Signal } from "./0_types.js"

// Bidirectionally bind two signals through before/after maps. `source` hydrates
// `local` on bind; afterwards each side's change propagates to the other.
export function sync<Local, Source>(
  local: Signal<Local>,
  source: Signal<Source>,
  transforms: { to: (local: Local) => Source; from: (source: Source) => Local },
): { unsubscribe(): void } {
  local.$(transforms.from(source.$()))

  let flowing = false
  let sourcePrimed = false
  const sourceSub = source.$.subscribe((s) => {
    if (!sourcePrimed) { sourcePrimed = true; return }
    if (flowing) return
    flowing = true
    local.$(transforms.from(s))
    flowing = false
  })

  let localPrimed = false
  const localSub = local.$.subscribe((l) => {
    if (!localPrimed) { localPrimed = true; return }
    if (flowing) return
    flowing = true
    source.$(transforms.to(l))
    flowing = false
  })

  return { unsubscribe: () => { sourceSub.unsubscribe(); localSub.unsubscribe() } }
}
