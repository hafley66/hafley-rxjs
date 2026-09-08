import { SignalReact } from "@hafley66/signals/react"
import type { ReactNode } from "react"
import { useEffect, useRef } from "react"
import { type AnySpec, describe, type Field, fmt, isStatic, pinSet } from "../spec/0_spec.js"
import type { SectionState } from "../spec/3_sections.js"
import { StateCombo } from "./StateCombo.js"

export const inputId = (section: string, key: string): string => `kit-${section}-${key}`

type El = HTMLInputElement | HTMLSelectElement
export type SpecPanelProps = { state: SectionState<AnySpec>; title?: string; extra?: ReactNode; fields?: "all" | "static" | "varying"; head?: boolean; fieldSettings?: (key: string, field: Field, state: SectionState<AnySpec>) => ReactNode }

type Val = string | number | boolean

const readInput = (el: El, fd: Field): Val => {
  if (fd.kind === "bool") return (el as HTMLInputElement).checked
  if (fd.kind === "select" || fd.kind === "text") return el.value
  const n = Number(el.value)
  return Number.isFinite(n) ? n : fd.default
}
// data-live inputs are driven by an animation loop and skip the sync (a scrub slider while playing)
const writeInput = (el: El, fd: Field, v: Val): void => {
  if (el.dataset.live) return
  if (fd.kind === "bool") (el as HTMLInputElement).checked = v === true
  else if (el.value !== String(v)) el.value = String(v)
}

// one panel per section: head (optional title, shuffle, state combobox, preset), one row per field grouped by fieldset
// as columns, statics in their own group, extra at the foot. Every row carries the field's tooltip.
export const SpecPanel = SignalReact(function SpecPanel({ state, title, extra, fieldSettings, fields = "all", head = true }: SpecPanelProps) {
  const { spec, id, presets } = state
  const values = state.values.$()
  const pins = pinSet(state.pins.$())
  const inputs = useRef(new Map<string, El>())

  useEffect(() => {
    for (const [k, el] of inputs.current) writeInput(el, spec[k], values[k])
  })

  const bind = (k: string) => (el: El | null) => {
    if (el) inputs.current.set(k, el)
    else inputs.current.delete(k)
  }
  const onInput = (k: string) => (e: { currentTarget: El }) =>
    state.set({ [k]: readInput(e.currentTarget, spec[k]) }, "replace")

  const row = (k: string, fd: Field) => {
    const eid = inputId(id, k)
    const label = fd.label ?? k
    const fixed = isStatic(fd)
    const common = { title: describe(k, fd), id: eid, "data-key": k, ref: bind(k), onInput: onInput(k) }
    let input: ReactNode
    if (fd.kind === "range")
      input = (
        <>
          <input
            {...common}
            type="range"
            min={fd.min}
            max={fd.max}
            step={fd.step ?? 1}
            defaultValue={String(values[k])}
            list={`${eid}-d`}
          />
          <datalist id={`${eid}-d`}>
            <option value={String(fd.default)} />
          </datalist>
        </>
      )
    else if (fd.kind === "number" || fd.kind === "seed")
      input = (
        <input
          {...common}
          type="number"
          step={fd.kind === "number" && fd.step !== undefined ? fd.step : undefined}
          defaultValue={String(values[k])}
        />
      )
    else if (fd.kind === "select")
      input = (
        <select {...common} defaultValue={String(values[k])}>
          {fd.options.map(o => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )
    else if (fd.kind === "bool") input = <input {...common} type="checkbox" defaultChecked={values[k] === true} />
    else input = <input {...common} type="text" size={fd.size ?? 24} defaultValue={String(values[k])} />
    const out = fd.kind === "range" || fd.kind === "number" || fd.kind === "seed" ? fmt(values[k]) : ""
    return (
      <div key={k} className="kit-row" data-kind={fd.kind} title={describe(k, fd)}>
        {fixed ? (
          <span className="kit-pin" />
        ) : (
          <input
            type="checkbox"
            className="kit-pin"
            data-pin={k}
            checked={pins.has(k)}
            aria-label={`pin ${k}`}
            title={`pin ${label}: shuffle skips it; pins travel in the url as ${id}.pin`}
            onChange={() => state.togglePin(k)}
          />
        )}
        <label htmlFor={eid} className="kit-lbl" title={describe(k, fd)}>
          {label}
        </label>
        <span className="kit-ctl">{input}</span>
        <output htmlFor={eid}>{out}</output>
        {fixed ? (
          <span className="kit-roll" />
        ) : (
          <button type="button" className="kit-roll" title={`reroll ${label} only`} onClick={() => state.roll(k)}>
            ↻
          </button>
        )}
        {fieldSettings && <span className="kit-field-settings">{fieldSettings(k, fd, state)}</span>}
      </div>
    )
  }

  const groups = new Map<string, ReactNode[]>()
  const statics = new Map<string, ReactNode[]>()
  for (const [k, fd] of Object.entries(spec)) {
    if (fields === "static" && !isStatic(fd) || fields === "varying" && isStatic(fd)) continue
    if (isStatic(fd)) {
      const g = fd.group ?? "static"
      if (!statics.has(g)) statics.set(g, [])
      statics.get(g)?.push(row(k, fd))
    }
    else {
      const g = fd.group ?? ""
      if (!groups.has(g)) groups.set(g, [])
      groups.get(g)?.push(row(k, fd))
    }
  }
  const presetNames = Object.keys(presets)
  const presetHit = presetNames.find(n => Object.entries(presets[n] ?? {}).every(([k, x]) => values[k] === x)) ?? ""

  return (
    <div className="kit-panel" data-section={id}>
      {head && <div className="kit-head">
        {title && <b className="kit-title">{title}</b>}
        <button
          type="button"
          className="kit-shuffle"
          title="reroll eligible unpinned fields from one fresh seed; adds a history entry"
          onClick={() => state.rollAll()}
        >
          shuffle
        </button>
        <StateCombo state={state} />
        {presetNames.length > 0 && (
          <select
            className="kit-preset"
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
      </div>}
      <div className="kit-groups">
        {[...statics].map(([g, rows]) => <fieldset key={g} className="kit-group kit-static" data-group={g}>
          <legend title={`${g}: shuffle keeps these controls`}>{g} · static</legend>{rows}
        </fieldset>)}
        {[...groups].map(([g, rows]) => (
          <fieldset key={g || "_"} className="kit-group" data-group={g}>
            <legend title={g || "geometry inputs"}>{g || " "}</legend>
            {rows}
          </fieldset>
        ))}
      </div>
      {extra && <div className="kit-extra">{extra}</div>}
    </div>
  )
})
