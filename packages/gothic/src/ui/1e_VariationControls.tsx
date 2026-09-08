import { type AnySpec, type Field, freshSeed, isStatic, mulberry32, type SectionState } from "@hafley66/report-shell"
import { Signal } from "@hafley66/signals"
import { useMemo } from "react"
import { propertyMotion } from "../kit/4_propertyMotion.js"
import { defaultVariation, DISTRIBUTIONS, resolveVariation, rollDistribution, STROKE_PROPERTIES, type Variation } from "../lib/7a_variation.js"

export function VariationInputs({ field, value, stroke, local = value, inherit = false, disabled = false, bounds = true, onChange }: {
  field: Field; value: Variation; stroke: boolean; local?: Partial<Variation>; inherit?: boolean; disabled?: boolean; bounds?: boolean; onChange(value: Partial<Variation>): void
}) {
  const numeric = field.kind === "range" || field.kind === "number"
  const numbers = {
    min: [numeric ? field.min ?? -1000000 : 0, numeric ? field.max ?? 1000000 : 1, numeric ? field.step ?? 1 : 0.01, "Lower output bound; discrete inputs map 0–1 into their choices"],
    max: [numeric ? field.min ?? -1000000 : 0, numeric ? field.max ?? 1000000 : 1, numeric ? field.step ?? 1 : 0.01, "Upper output bound"],
    period: [50, 60000, 50, "Full variation cycle in milliseconds; runs inside the page timeline"],
    harmonics: [1, 12, 1, "Each stroke chooses an integer harmonic up to this limit"],
    phase: [0, 1, 0.01, "Independent phase spread; 0 synchronizes phases, 1 spreads them around the cycle"],
    mix: [0, 1, 0.01, "Blend between the primary and secondary target distributions"],
    depth: [0, 1, 0.01, "Second variation layer: changes the distribution blend and harmonic amplitude"],
    seed: [0, 2147483647, 1, "Repeatable sample identities, phases, harmonics and amplitudes"],
  } as const
  const override = (key: keyof Variation) => inherit && <input type="checkbox" aria-label={`override variation ${key}`} title={`Override inherited ${key}; unchecked follows its parent`} disabled={disabled} checked={local[key] !== undefined} onChange={e => {
    const next = { ...local }
    if (e.currentTarget.checked) Object.assign(next, { [key]: value[key] })
    else delete next[key]
    onChange(next)
  }} />
  const choices = { mode: ["harmonic", "drift", "hold"], scope: ["input", "stroke"], distribution: DISTRIBUTIONS, secondary: DISTRIBUTIONS }
  const hints = { mode: "Harmonic oscillation, smooth drift through random targets, or held steps", scope: "Input shares one value; stroke samples every segmented stroke independently", distribution: "Primary target and amplitude distribution", secondary: "Second distribution blended with the primary" }
  return <div className="my-3 grid gap-2" data-variation-settings>
    {(Object.keys(choices) as (keyof typeof choices)[]).filter(key => key !== "scope" || stroke).map(key => <label key={key} title={hints[key]}>
      {override(key)}{key}<select aria-label={`variation ${key}`} value={value[key]} disabled={disabled || inherit && local[key] === undefined} onChange={e => onChange({ ...local, [key]: e.currentTarget.value })}>
        {choices[key].map(d => <option key={d}>{d}</option>)}
      </select>
    </label>)}
    {Object.entries(numbers).filter(([key]) => bounds || key !== "min" && key !== "max").map(([key, [min, max, step, hint]]) => <label key={key} title={hint}>
      {override(key as keyof Variation)}{key}<input type="number" aria-label={`variation ${key}`} min={min} max={max} step={step} value={value[key as keyof typeof numbers]} disabled={disabled || inherit && local[key as keyof Variation] === undefined} onChange={e => {
        const next = e.currentTarget.valueAsNumber
        if (Number.isFinite(next)) onChange({ ...local, [key]: Math.max(min, Math.min(max, next)) })
      }} />
    </label>)}
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={disabled} title="Draw new samples while preserving both distributions, output bounds and timing" onClick={() => onChange({ ...local, seed: freshSeed() })}>reroll samples</button>
      <button type="button" disabled={disabled} title="Override the two distributions, mixture, harmonic count and depth; preserve sample seed and output bounds" onClick={() => {
        const { distribution, secondary, mix, harmonics, depth } = rollDistribution(value, mulberry32(freshSeed()))
        onChange({ ...local, distribution, secondary, mix, harmonics, depth })
      }}>reroll distributions</button>
    </div>
  </div>
}

export function VariationDefaults({ page, state }: { page: string; state?: SectionState<AnySpec> }) {
  const model = propertyMotion(page), root = model.config, section = state ? root.sections[state.id].$() ?? { timing: {}, fields: {} } : undefined
  const local = section ? section.variation ?? {} : root.variation.$() ?? {}
  const field = { kind: "range", min: 0, max: 1, step: 0.01, default: 0.5 } as const
  const value = { ...defaultVariation(field, 0.5), period: section?.timing.duration ?? root.timing.duration.$(), ...root.variation.$(), ...local }
  const label = state ? "Section variation" : "Global variation", id = `variation-defaults-${page}-${state?.id ?? "page"}`
  return <>
    <button type="button" popoverTarget={id} title={`${label} defaults; only properties allowing inheritance use these settings`}>{label}</button>
    <div id={id} popover="auto" className="property-editor" role="dialog" aria-label={label}>
      <div className="flex justify-between"><strong>{label}</strong><button type="button" title="Close variation defaults" popoverTarget={id} popoverTargetAction="hide">close</button></div>
      <p>Properties set to None stay unchanged. Allow global reads page defaults. Allow cascade applies section and field overrides.</p>
      <VariationInputs field={field} value={value} stroke bounds={false} local={local} inherit={!!state} onChange={variation => {
        if (state && section) root.sections[state.id].$({ ...section, variation })
        else root.variation.$(variation)
      }} />
      <button type="button" title="Clear these overrides and inherit defaults" onClick={() => {
        if (state && section) root.sections[state.id].$({ ...section, variation: {} })
        else root.variation.$({})
      }}>reset defaults</button>
    </div>
  </>
}

export function SectionVariation({ state }: { state: SectionState<AnySpec> }) {
  const names = Object.keys(state.spec).filter(name => !isStatic(state.spec[name]) && state.spec[name].kind !== "seed")
  const ui = useMemo(() => Signal({ field: names.includes("weight") ? "weight" : names[0] ?? "" }), [state])
  const name = ui.field.$(), field = state.spec[name]
  if (!field) return null
  const model = propertyMotion(state.page), section = model.config.sections[state.id].$() ?? { timing: {}, fields: {} }
  const track = section.fields[name]
  const effective = track ? resolveVariation(field, state.values[name].$(), { ...track, enabled: true }, { period: track.timing.duration ?? section.timing.duration ?? model.config.timing.duration.$(), ...model.config.variation.$() }, section.variation) : undefined
  const stroke = (state.id === "timing" || state.page === "slice") && STROKE_PROPERTIES.has(name)
  const put = (next: typeof track) => model.config.sections[state.id].$({ ...section, fields: { ...section.fields, [name]: next } })
  const start = (mode: Variation["mode"]) => {
    put({ enabled: true, variationPolicy: "cascade", timing: track?.timing ?? {}, frames: track?.frames ?? [], variation: {
      ...track?.variation, scope: stroke ? "stroke" : "input", mode,
    } })
    model.clock.runtime.enabled.$(true)
    model.config.transport.run.$(true)
  }
  return <div className="flex flex-wrap items-center gap-3 py-2" data-section-variation={state.id}>
    <label title="Choose an input to vary over time; controls here survive geometry shuffle">vary
      <select aria-label={`${state.id} variation property`} value={name} onChange={e => ui.field.$(e.currentTarget.value)}>
        {names.map(key => <option key={key} value={key}>{state.spec[key].label ?? key}</option>)}
      </select>
    </label>
    <label title="None blocks variation; allow global uses only page defaults; allow cascade also applies section and field overrides">inheritance
      <select aria-label={`${state.id} variation inheritance`} value={track?.variationPolicy ?? (track?.variation ? "cascade" : "none")} onChange={e => {
        const policy = e.currentTarget.value as "none" | "global" | "cascade"
        put({ ...track, timing: track?.timing ?? {}, frames: track?.frames ?? [], enabled: policy !== "none", variationPolicy: policy })
      }}><option value="none">None</option><option value="global">Allow global</option><option value="cascade">Allow cascade</option></select>
    </label>
    <button type="button" title="Start smooth oscillation; each stroke has its own integer harmonic, phase and amplitude" onClick={() => start("harmonic")}>harmonic</button>
    <button type="button" title="Start smooth interpolation through repeatable random targets" onClick={() => start("drift")}>drift</button>
    <button type="button" title="Start stepped random targets; holds each value until the next step" onClick={() => start("hold")}>steps</button>
    <button type="button" title="Open this property's timeline, distributions and scope" popoverTarget={`timeline-${state.page}-${state.id}-${name}`}>settings</button>
    <button type="button" title="Draw new samples for this property; preserve its distribution settings" disabled={!effective || track.variationPolicy !== "cascade"} onClick={() => effective && put({ ...track, variation: { ...track.variation, seed: freshSeed() } })}>reroll samples</button>
    <button type="button" title="Roll this property's distribution settings while retaining its sample seed, bounds and timing" disabled={!effective || track.variationPolicy !== "cascade"} onClick={() => {
      if (!effective) return
      const { distribution, secondary, mix, harmonics, depth } = rollDistribution(effective, mulberry32(freshSeed()))
      put({ ...track, variation: { ...track.variation, distribution, secondary, mix, harmonics, depth } })
    }}>reroll distributions</button>
    <VariationDefaults page={state.page} state={state} />
    <label title="Enable this property's saved animation; disabling restores its saved input value"><input aria-label={`${state.id} vary ${name}`} type="checkbox" checked={track?.enabled ?? false} disabled={!track} onChange={e => put({ ...track, enabled: e.currentTarget.checked })} />enabled{stroke ? " · per stroke" : ""}</label>
  </div>
}
