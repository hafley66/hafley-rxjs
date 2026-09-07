import { SignalReact } from "@hafley66/signals/react"
import type { ReactNode } from "react"
import { useEffect, useRef } from "react"
import type { SectionState } from "../app/2_state.js"
import { type AnySpec, describe, type Field, fmt, isStatic, pinSet, readout } from "../kit/0_spec.js"

export const inputId = (section: string, key: string): string => `kit-${section}-${key}`

type El = HTMLInputElement | HTMLSelectElement
type BarProps = { state: SectionState<AnySpec>; title: string; extra?: ReactNode }

type Val = string | number | boolean

const readInput = (el: El, fd: Field): Val => {
  if (fd.kind === "bool") return (el as HTMLInputElement).checked
  if (fd.kind === "select" || fd.kind === "text") return el.value
  const n = Number(el.value)
  return Number.isFinite(n) ? n : fd.default
}
// data-live inputs are driven by an animation loop and skip the sync (border's offset slider while playing)
const writeInput = (el: El, fd: Field, v: Val): void => {
  if (el.dataset.live) return
  if (fd.kind === "bool") (el as HTMLInputElement).checked = v === true
  else if (el.value !== String(v)) el.value = String(v)
}

const FIELD = "border border-edge bg-well/60 px-1 py-px text-fg rounded-sm"

export const Bar = SignalReact(function Bar({ state, title, extra }: BarProps) {
  const { spec, id, presets } = state
  const values = state.values.$()
  const pins = pinSet(state.pins.$())
  const saved = state.states.$()
  const inputs = useRef(new Map<string, El>())
  const name = useRef<HTMLInputElement>(null)

  useEffect(() => {
    for (const [k, el] of inputs.current) writeInput(el, spec[k], values[k])
  })

  const bind = (k: string) => (el: El | null) => {
    if (el) inputs.current.set(k, el)
    else inputs.current.delete(k)
  }
  const onInput = (k: string) => (e: { currentTarget: El }) =>
    state.set({ [k]: readInput(e.currentTarget, spec[k]) }, "replace")

  const control = (k: string, fd: Field) => {
    const eid = inputId(id, k)
    const label = fd.label ?? k
    const pin = isStatic(fd) ? null : (
      <button
        type="button"
        className={`kit-pin grid size-3.5 shrink-0 place-items-center rounded-[3px] border ${pins.has(k) ? "on border-ink bg-ink/25" : "border-edge"}`}
        data-pin={k}
        title={`pin ${k}: shuffle skips it; pins travel in the url as ${id}.pin and survive reload`}
        aria-label={`pin ${k}`}
        onClick={() => state.togglePin(k)}
      >
        <span className={`block size-1.5 rounded-full ${pins.has(k) ? "bg-ink" : ""}`} />
      </button>
    )
    const common = { id: eid, "data-key": k, ref: bind(k), onInput: onInput(k) }
    let input: ReactNode
    if (fd.kind === "range")
      input = (
        <input
          {...common}
          type="range"
          min={fd.min}
          max={fd.max}
          step={fd.step ?? 1}
          defaultValue={String(values[k])}
          className="w-24 accent-ink"
        />
      )
    else if (fd.kind === "number" || fd.kind === "seed")
      input = (
        <input
          {...common}
          type="number"
          step={fd.kind === "number" && fd.step !== undefined ? fd.step : undefined}
          defaultValue={String(values[k])}
          className={`w-18 ${FIELD}`}
        />
      )
    else if (fd.kind === "select")
      input = (
        <select {...common} defaultValue={String(values[k])} className={FIELD}>
          {fd.options.map(o => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )
    else if (fd.kind === "bool")
      input = <input {...common} type="checkbox" defaultChecked={values[k] === true} className="accent-ink" />
    else
      input = <input {...common} type="text" size={fd.size ?? 24} defaultValue={String(values[k])} className={FIELD} />

    return (
      // biome-ignore lint/a11y/noLabelWithoutControl: the control is the input built above
      <label key={k} className="inline-flex items-center gap-1.5" title={describe(k, fd)}>
        {fd.kind === "bool" ? (
          <>
            {input}
            {label}
          </>
        ) : (
          <>
            {label}
            {input}
          </>
        )}
        {pin}
      </label>
    )
  }

  const groups = new Map<string, ReactNode[]>()
  const statics: ReactNode[] = []
  for (const [k, fd] of Object.entries(spec)) {
    if (isStatic(fd)) statics.push(control(k, fd))
    else {
      const g = fd.group ?? ""
      if (!groups.has(g)) groups.set(g, [])
      groups.get(g)?.push(control(k, fd))
    }
  }
  const presetNames = Object.keys(presets)
  const presetHit = presetNames.find(n => Object.entries(presets[n] ?? {}).every(([k, x]) => values[k] === x)) ?? ""

  return (
    <div
      className="kit-bar sticky z-[9] flex flex-wrap items-center gap-x-3 gap-y-1.5 border-line border-b bg-[#0c0e14] px-3.5 py-2 text-muted"
      style={{ top: "var(--kit-top)" }}
    >
      <b className="kit-title font-medium text-fg">{title}</b>
      <button
        type="button"
        className="kit-shuffle rounded-sm border border-edge px-1.5 py-px text-fg hover:border-ink"
        title="reroll every field that is neither static nor pinned, from one fresh seed; adds a history entry"
        onClick={() => state.rollAll()}
      >
        shuffle
      </button>
      {presetNames.length > 0 && (
        <select
          className={`kit-preset ${FIELD}`}
          title="apply a named partial value set; the select shows a preset while every value it sets still matches"
          value={presetHit}
          onChange={e => state.applyPreset(e.currentTarget.value)}
        >
          <option value="">preset…</option>
          {presetNames.map(n => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      )}
      {[...groups].map(([g, cs]) => (
        <span key={g || "_"} className="kit-group inline-flex flex-wrap items-center gap-x-3 gap-y-1.5" data-group={g}>
          {g && <i className="text-[11px] text-dim not-italic">{g}</i>}
          {cs}
        </span>
      ))}
      {statics.length > 0 && (
        <span className="kit-group kit-static inline-flex flex-wrap items-center gap-x-3 gap-y-1.5 border-edge border-l-2 pl-3 opacity-85">
          <i className="text-[11px] text-dim not-italic">static</i>
          {statics}
        </span>
      )}
      {extra && <span className="kit-extra inline-flex flex-wrap items-center gap-x-3 gap-y-1.5">{extra}</span>}
      <code
        className="kit-readout max-w-[60ch] overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[10px] text-dim"
        title={Object.entries(values)
          .map(([k, x]) => `${k}=${fmt(x)}`)
          .join("\n")}
      >
        {readout(spec, values)}
      </code>
      <span className="kit-states inline-flex flex-wrap items-center gap-1 border-edge border-l-2 pl-3">
        <input
          ref={name}
          className={`kit-state-name w-20 ${FIELD}`}
          placeholder="state name"
          size={8}
          title="name for the current values + pins; save stores them in localStorage for this section"
        />
        <button
          type="button"
          className="kit-save rounded-sm border border-edge px-1.5 py-px text-fg hover:border-ink"
          title="save the current values and pins under the name on the left"
          onClick={() => {
            state.save(name.current?.value ?? "")
            if (name.current) name.current.value = ""
          }}
        >
          save
        </button>
        {saved.map(s => (
          <span
            key={s.id}
            className={`kit-chip inline-flex items-center gap-1 rounded-xl border py-px pr-1 pl-2 ${s.star ? "star border-ink" : "border-edge"}`}
            data-id={s.id}
          >
            <button
              type="button"
              data-act="load"
              className="cursor-pointer font-medium text-fg"
              title="load this saved state (values + pins); adds a history entry"
              onClick={() => state.load(s.id)}
            >
              {s.name}
            </button>
            <button
              type="button"
              data-act="star"
              className="px-0.5"
              title="star: keep it first"
              onClick={() => state.star(s.id)}
            >
              {s.star ? "★" : "☆"}
            </button>
            <button
              type="button"
              data-act="del"
              className="px-0.5"
              title="delete this saved state"
              onClick={() => state.remove(s.id)}
            >
              ×
            </button>
          </span>
        ))}
      </span>
    </div>
  )
})
