import type { Signal } from "@hafley66/signals"
import {
  type AnySpec,
  type Field,
  type PinValues,
  type Presets,
  type ValuesOf,
  fmt,
  freshSeed,
  isStatic,
  mulberry32,
  pinSet,
  pinText,
  readout,
  shuffle,
} from "./0_spec.js"
import { commit } from "./1_url.js"
import type { Store } from "./6_store.js"

export const inputId = (section: string, key: string): string => `kit-${section}-${key}`

export type BarOpts<S extends AnySpec> = {
  id: string
  spec: S
  values: Signal<ValuesOf<S>>
  pins: Signal<PinValues>
  store: Store
  presets?: Presets<ValuesOf<S>>
  title?: string
}
export type Bar = { el: HTMLElement; extra: HTMLElement; sync(): void }

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")

function control(id: string, key: string, fd: Field): string {
  const eid = inputId(id, key)
  const label = esc(fd.label ?? key)
  const pin = isStatic(fd)
    ? ""
    : `<button type="button" class="kit-pin" data-pin="${esc(key)}" title="pin: shuffle skips this field" aria-label="pin"></button>`
  switch (fd.kind) {
    case "range":
      return `<label>${label} <input id="${eid}" data-key="${esc(key)}" type="range" min="${fd.min}" max="${fd.max}" step="${fd.step ?? 1}" value="${fd.default}">${pin}</label>`
    case "number":
    case "seed":
      return `<label>${label} <input id="${eid}" data-key="${esc(key)}" type="number"${fd.kind === "number" && fd.step !== undefined ? ` step="${fd.step}"` : ""} value="${fd.default}">${pin}</label>`
    case "select":
      return `<label>${label} <select id="${eid}" data-key="${esc(key)}">${fd.options.map(o => `<option value="${esc(o)}"${o === fd.default ? " selected" : ""}>${esc(o)}</option>`).join("")}</select>${pin}</label>`
    case "bool":
      return `<label><input id="${eid}" data-key="${esc(key)}" type="checkbox"${fd.default ? " checked" : ""}> ${label}${pin}</label>`
    case "text":
      return `<label>${label} <input id="${eid}" data-key="${esc(key)}" type="text" size="${fd.size ?? 24}" value="${esc(fd.default)}">${pin}</label>`
  }
}

function readInput(el: HTMLInputElement | HTMLSelectElement, fd: Field): unknown {
  if (fd.kind === "bool") return (el as HTMLInputElement).checked
  if (fd.kind === "select" || fd.kind === "text") return el.value
  const n = Number(el.value)
  return Number.isFinite(n) ? n : fd.default
}

// data-live inputs are driven by an animation loop and skip sync (border's offset slider while playing)
function writeInput(el: HTMLInputElement | HTMLSelectElement, fd: Field, v: unknown): void {
  if (el.dataset.live) return
  if (fd.kind === "bool") (el as HTMLInputElement).checked = v === true
  else if (el.value !== String(v)) el.value = String(v)
}

const chip = (s: { id: number; name: string; star: boolean }) =>
  `<span class="kit-chip${s.star ? " star" : ""}" data-id="${s.id}"><b>${esc(s.name)}</b><button type="button" data-act="star">${s.star ? "★" : "☆"}</button><button type="button" data-act="del">×</button></span>`

// groups render in first-appearance order; every static or shuffle:false field lands in the trailing static cluster
export function bar<S extends AnySpec>(host: HTMLElement, o: BarOpts<S>): Bar {
  const { id, spec, values, pins, store } = o
  const groups = new Map<string, string[]>()
  const statics: string[] = []
  for (const [k, fd] of Object.entries(spec)) {
    if (isStatic(fd)) statics.push(control(id, k, fd))
    else {
      const g = fd.group ?? ""
      if (!groups.has(g)) groups.set(g, [])
      groups.get(g)?.push(control(id, k, fd))
    }
  }
  const presetNames = Object.keys(o.presets ?? {})
  const el = document.createElement("div")
  el.className = "kit-bar"
  el.innerHTML =
    `<b class="kit-title">${esc(o.title ?? id)}</b>` +
    `<button type="button" class="kit-shuffle">shuffle</button>` +
    (presetNames.length
      ? `<select class="kit-preset"><option value="">preset…</option>${presetNames.map(n => `<option>${esc(n)}</option>`).join("")}</select>`
      : "") +
    [...groups]
      .map(
        ([g, cs]) =>
          `<span class="kit-group"${g ? ` data-group="${esc(g)}"` : ""}>${g ? `<i>${esc(g)}</i>` : ""}${cs.join("")}</span>`,
      )
      .join("") +
    (statics.length ? `<span class="kit-group kit-static"><i>static</i>${statics.join("")}</span>` : "") +
    `<span class="kit-extra"></span><code class="kit-readout"></code>` +
    `<span class="kit-states"><input class="kit-state-name" placeholder="state name" size="8"><button type="button" class="kit-save">save</button><span class="kit-chips"></span></span>`
  host.append(el)
  const q = <T extends Element>(s: string) => el.querySelector<T>(s) as T
  const extra = q<HTMLElement>(".kit-extra")
  const out = q<HTMLElement>(".kit-readout")
  const preset = el.querySelector<HTMLSelectElement>(".kit-preset")
  const chips = q<HTMLElement>(".kit-chips")
  const nameInput = q<HTMLInputElement>(".kit-state-name")
  const inputs = new Map<string, HTMLInputElement | HTMLSelectElement>()
  for (const n of el.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-key]"))
    inputs.set(n.dataset.key as string, n)

  const sync = () => {
    const v = values.$()
    for (const [k, n] of inputs) writeInput(n, spec[k], v[k])
    out.textContent = readout(spec, v)
    out.title = Object.entries(v)
      .map(([k, x]) => `${k}=${fmt(x)}`)
      .join("\n")
    if (preset)
      preset.value = presetNames.find(n => Object.entries(o.presets?.[n] ?? {}).every(([k, x]) => v[k] === x)) ?? ""
  }
  const syncPins = () => {
    const p = pinSet(pins.$())
    for (const b of el.querySelectorAll<HTMLButtonElement>(".kit-pin")) {
      const on = p.has(b.dataset.pin as string)
      b.textContent = on ? "●" : "○"
      b.classList.toggle("on", on)
    }
  }
  const renderChips = () => {
    chips.innerHTML = store.list().map(chip).join("")
  }

  el.addEventListener("input", e => {
    const n = e.target as HTMLInputElement
    const k = n.dataset.key
    const fd = k ? spec[k] : undefined
    if (!k || !fd) return
    const next = readInput(n, fd)
    commit("replace", () => values.$({ ...values.$(), [k]: next }))
  })
  el.addEventListener("click", e => {
    const t = e.target as HTMLElement
    if (t.closest(".kit-shuffle"))
      return commit("push", () => values.$(shuffle(spec, values.$(), mulberry32(freshSeed()), pinSet(pins.$()))))
    const pinBtn = t.closest<HTMLButtonElement>(".kit-pin")
    if (pinBtn) {
      const p = pinSet(pins.$())
      const k = pinBtn.dataset.pin as string
      if (p.has(k)) p.delete(k)
      else p.add(k)
      return commit("replace", () => pins.$({ pin: pinText(p) }))
    }
    if (t.closest(".kit-save")) {
      store.add(nameInput.value, values.$(), pins.$().pin)
      nameInput.value = ""
      return renderChips()
    }
    const c = t.closest<HTMLElement>(".kit-chip")
    if (!c) return
    const sid = Number(c.dataset.id)
    const act = t.dataset.act
    if (act === "del") store.remove(sid)
    else if (act === "star") store.star(sid)
    else {
      const s = store.list().find(x => x.id === sid)
      if (s)
        commit("push", () => {
          values.$({ ...values.$(), ...(s.vals as Partial<ValuesOf<S>>) })
          pins.$({ pin: s.pin })
        })
    }
    renderChips()
  })
  preset?.addEventListener("change", () => {
    const p = o.presets?.[preset.value]
    if (p) commit("push", () => values.$({ ...values.$(), ...p }))
  })
  values.$.subscribe(sync)
  pins.$.subscribe(syncPins)
  renderChips()
  return { el, extra, sync }
}
