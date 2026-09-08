import { Signal } from "@hafley66/signals"
import type { AnySpec, SectionState } from "@hafley66/report-shell"
import { Subject, tap } from "rxjs"
import { expect, it } from "vitest"
import { DEFAULT_TIMING } from "../lib/7_propertyTimeline.js"
import { createPropertyMotion, type PropertyMotionConfig } from "./4_propertyMotion.js"
import { defaultVariation } from "../lib/7a_variation.js"

it("shares one cold clock across property projections and leaves saved inputs unchanged", () => {
  const config = Signal<PropertyMotionConfig>({ transport: { time: 0, speed: 1, run: true }, timing: DEFAULT_TIMING, sections: {
    shape: { timing: {}, fields: { n: { enabled: true, timing: { duration: 1000, loop: false }, frames: [{ at: 0, value: 3 }, { at: 1, value: 9 }] } } },
  } })
  const base = Signal({ n: 5 }), ticks = new Subject<number>()
  let listeners = 0
  const model = createPropertyMotion(config, ticks.pipe(tap({ subscribe: () => listeners++, finalize: () => listeners-- })))
  const state = { id: "shape", spec: { n: { kind: "range", min: 2, max: 9, default: 5 } }, values: base } as unknown as SectionState<AnySpec>
  const values = model.values(state), receipt: unknown[] = []
  expect(model.values(state)).toBe(values)
  expect(listeners).toBe(0)
  const first = values.n.$.subscribe(), second = values.$.subscribe()
  const record = () => receipt.push([listeners, values.n.$(), base.n.$()])
  record(); ticks.next(250); record()
  config.sections.shape.fields.n.timing.$({ duration: 500, loop: false }); record()
  config.sections.shape.fields.n.enabled.$(false); record()
  config.sections.shape.fields.n.enabled.$(true); record()
  first.unsubscribe(); second.unsubscribe(); record()
  expect(receipt).toMatchSnapshot()
  expect(listeners).toBe(0)
  expect(base.$()).toEqual({ n: 5 })
})

it("shares a cold stroke clock and applies global or cascading settings only with field permission", () => {
  const spec = { weight: { kind: "range", min: 0.1, max: 3, step: 0.01, default: 1 } } as const
  const base = Signal({ weight: 1 }), ticks = new Subject<number>()
  const config = Signal<PropertyMotionConfig>({ transport: { time: 0, speed: 1, run: true }, timing: DEFAULT_TIMING,
    variation: { ...defaultVariation(spec.weight, 1), scope: "stroke", seed: 17 }, sections: { art: {
      timing: {}, variation: { seed: 23 }, fields: { weight: { enabled: true, variationPolicy: "none", variation: { seed: 31 }, timing: {}, frames: [] } },
    } },
  })
  let listeners = 0
  const model = createPropertyMotion(config, ticks.pipe(tap({ subscribe: () => listeners++, finalize: () => listeners-- })))
  const state = { id: "art", spec, values: base } as unknown as SectionState<AnySpec>
  const strokes = model.strokes(state), values = model.values(state), receipt: unknown[] = []
  const a = strokes.$.subscribe(), b = strokes.$.subscribe(), c = values.$.subscribe()
  const record = () => receipt.push({ listeners, time: strokes.time.$(), seed: strokes.fields.weight.seed.$(), base: base.$(), values: values.$() })
  record()
  config.sections.art.fields.weight.variationPolicy.$("global"); ticks.next(250); record()
  config.sections.art.fields.weight.variationPolicy.$("cascade"); ticks.next(250); record()
  config.sections.art.fields.weight.variation.$({}); record()
  config.sections.art.fields.weight.variationPolicy.$("none"); record()
  a.unsubscribe(); b.unsubscribe(); c.unsubscribe()
  expect(listeners).toBe(0)
  expect(receipt).toMatchSnapshot()
})
