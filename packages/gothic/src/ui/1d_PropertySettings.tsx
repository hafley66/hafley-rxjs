import { type AnySpec, type Field, freshSeed, mulberry32, rollField, type SectionState } from "@hafley66/report-shell"
import { propertyMotion, type PropertyMotion } from "../kit/4_propertyMotion.js"
import { DEFAULT_TIMING, type PropertyTrack, type TimelineValue, type Timing } from "../lib/7_propertyTimeline.js"
import { AnimationControls } from "./1b_AnimationControls.js"
import { defaultVariation, resolveVariation, STROKE_PROPERTIES, type VariationPolicy } from "../lib/7a_variation.js"
import { VariationInputs } from "./1e_VariationControls.js"
import { createPortal } from "react-dom"

function TimingInputs({ scope, local, parent, inherit = true, onChange }: {
  scope: string; local: Partial<Timing>; parent: Timing; inherit?: boolean; onChange(value: Partial<Timing>): void
}) {
  const effective = { ...parent, ...local }
  return <div className="grid gap-2">
    {(Object.keys(DEFAULT_TIMING) as (keyof Timing)[]).map(key => <label key={key} className="flex items-center gap-2" title={`${scope} ${key}`}>
      {inherit && <input type="checkbox" aria-label={`${scope} override ${key}`} checked={local[key] !== undefined} onChange={e => {
        const next = { ...local }
        if (e.currentTarget.checked) Object.assign(next, { [key]: effective[key] })
        else delete next[key]
        onChange(next)
      }} />}
      <span className="w-20">{key}</span>
      {key === "duration" || key === "delay"
        ? <input type="number" aria-label={`${scope} ${key}`} min={key === "duration" ? 50 : 0} max={60000} step={50}
          disabled={inherit && local[key] === undefined} value={effective[key]} onChange={e => {
            const value = Number(e.currentTarget.value)
            if (Number.isFinite(value)) onChange({ ...local, [key]: Math.max(key === "duration" ? 50 : 0, Math.min(60000, value)) })
          }} />
        : key === "loop" ? <input type="checkbox" aria-label={`${scope} loop`} checked={effective.loop} disabled={inherit && local.loop === undefined}
          onChange={e => onChange({ ...local, loop: e.currentTarget.checked })} />
        : <select aria-label={`${scope} ${key}`} value={effective[key]} disabled={inherit && local[key] === undefined} onChange={e => onChange({ ...local, [key]: e.currentTarget.value })}>
          {(key === "easing" ? ["linear", "inOutSine", "inOutQuad"] : ["normal", "reverse", "alternate"]).map(value => <option key={value}>{value}</option>)}
        </select>}
      {(key === "duration" || key === "delay") && <span>ms</span>}
    </label>)}
  </div>
}

function ValueInput({ field, value, label, onChange }: { field: Field; value: TimelineValue; label: string; onChange(value: TimelineValue): void }) {
  if (field.kind === "bool") return <select aria-label={label} title={label} value={String(value)} onChange={e => onChange(e.currentTarget.value === "true")}><option>true</option><option>false</option></select>
  if (field.kind === "select") return <select aria-label={label} title={label} value={String(value)} onChange={e => onChange(e.currentTarget.value)}>{field.options.map(value => <option key={value}>{value}</option>)}</select>
  if (field.kind === "text") return <input aria-label={label} title={label} value={String(value)} onChange={e => onChange(e.currentTarget.value)} />
  return <input type="number" aria-label={label} title={label} value={Number(value)}
    min={field.kind === "seed" ? 0 : field.min} max={field.kind === "seed" ? 2147483647 : field.max} step={field.kind === "seed" ? 1 : field.step ?? 1}
    onChange={e => { if (Number.isFinite(e.currentTarget.valueAsNumber)) onChange(e.currentTarget.valueAsNumber) }} />
}

export function PropertyTransport({ model }: { model: PropertyMotion }) {
  const t = model.config.timing.$(), span = t.duration * (t.direction === "alternate" ? 2 : 1) + t.delay
  const frame = model.clock.frame.$()
  return <AnimationControls label="Property timeline" duration={span} time={frame.time} running={frame.active} loop={t.loop} holdTitle="Hold the property timeline at this frame"
    onSeek={ms => { model.config.transport.$({ ...model.config.transport.$(), time: ms / span, run: false }); model.clock.seek(ms) }}
    onToggle={() => model.config.transport.run.$(!frame.active)}
    onReplay={() => { model.config.transport.time.$(0); model.clock.replay() }} />
}

export function PropertySettings({ state, field, name }: { state: SectionState<AnySpec>; field: Field; name: string }) {
  const model = propertyMotion(state.page), config = model.config
  const section = config.sections[state.id].$() ?? { timing: {}, fields: {} }
  const base = state.values[name].$() as TimelineValue
  const existing = section.fields[name]
  const track: PropertyTrack = existing ?? { enabled: false, timing: {}, frames: [
    { at: 0, value: base }, { at: 1, value: field.kind === "range" || field.kind === "number" ? field.max ?? base : base },
  ] }
  const pageTiming = config.timing.$(), sectionTiming = { ...pageTiming, ...section.timing }
  const put = (next: PropertyTrack) => config.sections[state.id].$({ ...section, fields: { ...section.fields, [name]: next } })
  const id = `timeline-${state.page}-${state.id}-${name}`
  const effective = { ...sectionTiming, ...track.timing }
  const policy = track.variationPolicy ?? (track.variation ? "cascade" : "none")
  const variation = resolveVariation(field, base, { ...track, enabled: true }, { period: effective.duration, ...config.variation.$() }, section.variation)
  return <>
    <button type="button" className="kit-settings" popoverTarget={id} title={`${name} animation settings`} aria-label={`${name} animation settings`} data-active={track.enabled || undefined}>⚙</button>
    {createPortal(<div id={id} popover="auto" className="property-editor" role="dialog" aria-label={`${name} animation settings`}>
      <div className="mb-3 flex items-center justify-between gap-4"><strong>{state.id}.{name}</strong><button type="button" title="close animation settings" popoverTarget={id} popoverTargetAction="hide">close</button></div>
      <label className="flex items-center gap-2" title={`animate ${name}`}><input type="checkbox" aria-label={`animate ${name}`} checked={track.enabled} onChange={e => put({ ...track, enabled: e.currentTarget.checked })} />animate this input</label>
      <label title="Choose a keyframe table, harmonic oscillation, smooth random drift or stepped random targets">motion
        <select aria-label={`${name} motion`} value={track.variation || policy !== "none" ? "variation" : "keyframes"} onChange={e => {
          const mode = e.currentTarget.value
          if (mode === "keyframes") { const { variation, variationPolicy, ...next } = track; put(next) }
          else put({ ...track, variationPolicy: "cascade", variation: track.variation ?? {} })
        }}><option value="keyframes">keyframes</option><option value="variation">variation</option></select>
      </label>
      <label title="None blocks variation. Allow global reads page defaults. Allow cascade overlays section and field settings.">variation inheritance
        <select aria-label={`${name} variation inheritance`} value={policy} onChange={e => put({ ...track, variationPolicy: e.currentTarget.value as VariationPolicy })}>
          <option value="none">None</option><option value="global">Allow global</option><option value="cascade">Allow cascade</option>
        </select>
      </label>
      {(track.variation || policy !== "none") && <VariationInputs field={field} value={variation ?? defaultVariation(field, base)} local={track.variation ?? {}} inherit disabled={policy !== "cascade"} stroke={(state.id === "timing" || state.page === "slice") && STROKE_PROPERTIES.has(name)} onChange={variation => put({ ...track, variation })} />}
      <p className="my-2 text-xs text-muted">Live: {String(model.values(state)[name].$())} · saved: {String(base)} · {effective.duration}ms</p>
      <PropertyTransport model={model} />
      <details className="my-3"><summary title="page timing defaults">Page timing</summary><TimingInputs scope="page" local={pageTiming} parent={DEFAULT_TIMING} inherit={false} onChange={value => config.timing.$({ ...DEFAULT_TIMING, ...value })} /></details>
      <details className="my-3"><summary title="section timing overrides">Section timing</summary><TimingInputs scope="section" local={section.timing} parent={pageTiming} onChange={timing => config.sections[state.id].$({ ...section, timing })} /></details>
      <details className="my-3" open><summary title="field timing overrides">Field timing</summary><TimingInputs scope="field" local={track.timing} parent={sectionTiming} onChange={timing => put({ ...track, timing })} /></details>
      <p className="my-2 text-xs text-muted">Checked timing values override the parent. Field cycles run inside the page timeline. Numeric values interpolate; other values switch at the row time.</p>
      <table className="w-full text-left" hidden={!!track.variation || policy !== "none"}><thead><tr><th title="keyframe position in the field cycle">time %</th><th title="input value at this keyframe">value</th><th /></tr></thead><tbody>
        {track.frames.map((frame, i) => <tr key={i}>
          <td><input type="number" min={0} max={100} step={1} aria-label={`${name} row ${i + 1} time`} title="keyframe position as a percentage" value={Math.round(frame.at * 100)} onChange={e => {
            const at = Math.max(0, Math.min(1, e.currentTarget.valueAsNumber / 100))
            if (Number.isFinite(at)) put({ ...track, frames: track.frames.map((f, j) => j === i ? { ...f, at } : f) })
          }} /></td>
          <td><ValueInput field={field} value={frame.value} label={`${name} row ${i + 1} value`} onChange={value => put({ ...track, frames: track.frames.map((f, j) => j === i ? { ...f, value } : f) })} /></td>
          <td><button type="button" title="delete keyframe" onClick={() => put({ ...track, frames: track.frames.filter((_, j) => j !== i) })}>×</button></td>
        </tr>)}
      </tbody></table>
      <div className="mt-3 flex gap-3">
        <button type="button" title="add a keyframe at the middle" onClick={() => put({ ...track, frames: [...track.frames, { at: 0.5, value: base }] })}>add row</button>
        <button type="button" title="roll keyframe values while keeping their times" onClick={() => { const rng = mulberry32(freshSeed()); put({ ...track, frames: track.frames.map(f => ({ ...f, value: rollField(field, rng) as TimelineValue })) }) }}>roll values</button>
        <button type="button" title="clear this field's timeline and inherit timing" onClick={() => { const fields = { ...section.fields }; delete fields[name]; config.sections[state.id].$({ ...section, fields }) }}>reset field</button>
      </div>
    </div>, document.body)}
  </>
}
