// Top bar: active/live/today/total counts, a time-window select, the status legend, a text
// filter, and one chip per frame kind actually present in the data.
import { SignalReact } from "@hafley66/signals/react"
import { patchContinuous, type Model, type Prefs } from "../model"
import type { TimeWindow } from "../../lib/window.js"
import type { Signal as SignalType } from "@hafley66/signals"
import { StatusLegend } from "./StatusLegend"

const WINDOW_OPTIONS: TimeWindow[] = ["active", "live", "today", "7d", "all"]

function HeaderView({ model, prefs, meta }: { model: Model; prefs: SignalType<Prefs>; meta: string }) {
  const cont = model.continuous.$()
  const kinds = model.frameKinds.$()
  const counts = model.counts.$()
  const current = prefs.$()
  return (
    <header>
      <b>boop network</b>
      <span className="counts" data-testid="counts">
        A {counts.active} active · L {counts.live} live · T {counts.today} today · N {counts.total} sessions
      </span>
      <span id="meta">{meta}</span>
      <select
        data-testid="window-select"
        value={current.window}
        onChange={(event) => prefs.$({ ...current, window: event.target.value as TimeWindow })}
      >
        {WINDOW_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <StatusLegend />
      <input
        type="text"
        placeholder="filter session / harness / cwd / frame preview"
        value={cont.search}
        onChange={(event) => patchContinuous(model, { search: event.target.value })}
      />
      {kinds.map((kind) => (
        <label key={kind} className="kind-chip" data-kind={kind}>
          <input
            type="checkbox"
            checked={cont.kinds.includes(kind)}
            onChange={(event) => {
              const nextKinds = event.target.checked ? [...cont.kinds, kind] : cont.kinds.filter((k) => k !== kind)
              patchContinuous(model, { kinds: nextKinds })
            }}
          />
          {kind}
        </label>
      ))}
    </header>
  )
}

export const Header = SignalReact(HeaderView)
