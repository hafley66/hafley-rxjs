import { SignalReact } from "@hafley66/signals/react"
import type { ReactNode } from "react"
import { useEffect, useRef, useState } from "react"
import type { SectionState } from "../app/2_state.js"
import { type AnySpec, describe, type Field, fmt, isStatic, pinSet } from "../kit/0_spec.js"

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

// a short diff against the defaults, for the states list
const brief = (spec: AnySpec, vals: Record<string, unknown>): string =>
  Object.entries(vals)
    .filter(([k, v]) => spec[k] && v !== spec[k].default)
    .slice(0, 4)
    .map(([k, v]) => `${k}=${fmt(v)}`)
    .join(" ")

/* state combobox: the input shows the state receiving every edit; typing an existing name selects it, Enter on a new
   name forks the current values into a new state; the list under it carries star and delete per row */
const Combo = SignalReact(function Combo({ state }: { state: SectionState<AnySpec> }) {
  const saved = state.states.$()
  const sid = state.selected.$()
  const cur = saved.find(s => s.id === sid)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(cur?.name ?? "")
  const listId = `kit-states-${state.page}-${state.id}`.replace(/[^a-z0-9_-]/gi, "_")
  useEffect(() => {
    setText(cur?.name ?? "")
  }, [cur?.name])
  const pick = (name: string) => {
    const hit = saved.find(s => s.name === name.trim())
    if (hit) state.load(hit.id)
  }
  return (
    <div className="kit-combo" data-open={open || undefined}>
      <input
        list={listId}
        value={text}
        placeholder="state…"
        aria-label="state"
        title="state: the shown name receives every edit. Pick another to load it, type a new name and press Enter to fork the current values into it"
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={e => {
          setText(e.currentTarget.value)
          pick(e.currentTarget.value)
        }}
        onKeyDown={e => {
          if (e.key === "Enter" && text.trim()) {
            state.save(text)
            e.currentTarget.blur()
          }
          if (e.key === "Escape") e.currentTarget.blur()
        }}
      />
      <datalist id={listId}>
        {saved.map(s => (
          <option key={s.id} value={s.name} />
        ))}
      </datalist>
      <span className="kit-sync" title={cur ? `synced into ${cur.name}` : "autosave only; pick or name a state"}>
        {cur ? "●" : "○"}
      </span>
      <ul onMouseDown={e => e.preventDefault()}>
        {saved.map(s => (
          <li key={s.id} className={s.id === sid ? "sel" : undefined} data-id={s.id}>
            <button type="button" className="name" title="load and select" onClick={() => state.load(s.id)}>
              {s.star ? "★ " : ""}
              {s.name}
              <small>{brief(state.spec, s.vals)}</small>
            </button>
            <button type="button" className="i" title={s.star ? "unstar" : "star"} onClick={() => state.star(s.id)}>
              {s.star ? "★" : "☆"}
            </button>
            <button type="button" className="i" title="delete" onClick={() => state.remove(s.id)}>
              ×
            </button>
          </li>
        ))}
        <li className="new">
          {text.trim() && !saved.some(s => s.name === text.trim())
            ? `Enter: new state "${text.trim()}"`
            : "type a name, Enter saves"}
        </li>
      </ul>
    </div>
  )
})

// one rail panel per section: head (title, shuffle, preset, state), one row per field grouped by fieldset, extra at the foot
export const Bar = SignalReact(function Bar({ state, title, extra }: BarProps) {
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
    const common = { id: eid, "data-key": k, ref: bind(k), onInput: onInput(k) }
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
        <label htmlFor={eid} className="kit-lbl">
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
      </div>
    )
  }

  const groups = new Map<string, ReactNode[]>()
  const statics: ReactNode[] = []
  for (const [k, fd] of Object.entries(spec)) {
    if (isStatic(fd)) statics.push(row(k, fd))
    else {
      const g = fd.group ?? ""
      if (!groups.has(g)) groups.set(g, [])
      groups.get(g)?.push(row(k, fd))
    }
  }
  const presetNames = Object.keys(presets)
  const presetHit = presetNames.find(n => Object.entries(presets[n] ?? {}).every(([k, x]) => values[k] === x)) ?? ""

  return (
    <div className="kit-bar kit-panel" data-section={id}>
      <div className="kit-head">
        <b className="kit-title">{title}</b>
        <button
          type="button"
          className="kit-shuffle"
          title="reroll every field that is neither static nor pinned, from one fresh seed; adds a history entry"
          onClick={() => state.rollAll()}
        >
          shuffle
        </button>
        <Combo state={state} />
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
      </div>
      <div className="kit-groups">
        {[...groups].map(([g, rows]) => (
          <fieldset key={g || "_"} className="kit-group" data-group={g}>
            <legend>{g || "\u00a0"}</legend>
            {rows}
          </fieldset>
        ))}
        {statics.length > 0 && (
          <fieldset className="kit-group kit-static">
            <legend>static · not shuffled</legend>
            {statics}
          </fieldset>
        )}
      </div>
      {extra && <div className="kit-extra">{extra}</div>}
    </div>
  )
})
