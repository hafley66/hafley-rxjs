import { SignalReact } from "@hafley66/signals/react"
import { useEffect, useState } from "react"
import { type AnySpec, fmt } from "../spec/0_spec.js"
import type { SectionState } from "../spec/3_sections.js"

// a short diff against the defaults, for the states list
const brief = (spec: AnySpec, vals: Record<string, unknown>): string =>
  Object.entries(vals)
    .filter(([k, v]) => spec[k] && v !== spec[k].default)
    .slice(0, 4)
    .map(([k, v]) => `${k}=${fmt(v)}`)
    .join(" ")

/* state combobox: the input shows the state receiving every edit; typing an existing name selects it, Enter on a new
   name forks the current values into a new state; ArrowUp/Down walk the rows and Enter loads the active row;
   the list under it carries star and delete per row */
export const StateCombo = SignalReact(function StateCombo({ state }: { state: SectionState<AnySpec> }) {
  const saved = state.states.$()
  const sid = state.selected.$()
  const cur = saved.find(s => s.id === sid)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(cur?.name ?? "")
  const [active, setActive] = useState(-1)
  const listId = `kit-states-${state.page}-${state.id}`.replace(/[^a-z0-9_-]/gi, "_")
  useEffect(() => {
    setText(cur?.name ?? "")
  }, [cur?.name])
  const pick = (name: string) => {
    const hit = saved.find(s => s.name === name.trim())
    if (hit) state.load(hit.id)
  }
  const fresh = text.trim() !== "" && !saved.some(s => s.name === text.trim())
  return (
    <div className="kit-combo" data-open={open || undefined}>
      <input
        list={listId}
        value={text}
        placeholder="state…"
        aria-label="state"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${listId}-rows`}
        aria-autocomplete="list"
        title="state: the shown name receives every edit. Pick another to load it, type a new name and press Enter to fork the current values into it. ArrowUp/Down walk the rows"
        onFocus={() => {
          setOpen(true)
          setActive(-1)
        }}
        onBlur={() => setOpen(false)}
        onChange={e => {
          setText(e.currentTarget.value)
          setActive(-1)
          pick(e.currentTarget.value)
        }}
        onKeyDown={e => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            if (saved.length === 0) return
            e.preventDefault()
            const step = e.key === "ArrowDown" ? 1 : -1
            setActive(i => (i + step + saved.length + (i < 0 && step < 0 ? 1 : 0)) % saved.length)
            return
          }
          if (e.key === "Enter") {
            const row = saved[active]
            if (row) state.load(row.id)
            else if (text.trim()) state.save(text)
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
      <ul id={`${listId}-rows`} onMouseDown={e => e.preventDefault()}>
        {saved.map((s, i) => (
          <li
            key={s.id}
            className={[s.id === sid ? "sel" : "", i === active ? "active" : ""].join(" ").trim() || undefined}
            data-id={s.id}
          >
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
        <li className="new">{fresh ? `Enter: new state "${text.trim()}"` : "type a name, Enter saves"}</li>
      </ul>
    </div>
  )
})
