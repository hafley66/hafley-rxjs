import { Signal } from "@hafley66/signals"
import { skip } from "rxjs"
import {
  type AnySpec,
  defaultsOf,
  freshSeed,
  mulberry32,
  PIN_SPEC,
  type PinValues,
  type Presets,
  parseValues,
  pinSet,
  pinText,
  shuffle,
  type ValuesOf,
} from "../kit/0_spec.js"
import { type Mode, mergeSearch, type Namespaces, type NsValues, parseSearch, printSearch } from "../kit/1_url.js"
import { currentPin, type Saved, type Store, store } from "../kit/3_store.js"
import { loc, writeSearch } from "./1_router.js"
import { transition } from "./3_view.js"

export const STORAGE = "gothic"

type Cell = {
  page: string
  id: string
  spec: AnySpec
  values: Signal<Record<string, unknown>>
  pins: Signal<PinValues>
}
const cells = new Map<string, Cell>()
let active = ""
let applying = false
let written = ""
let mode: Mode = "replace"

// the page-global namespace: ?page.z, ?page.draw; every route keeps it
export const PAGE_SPEC = {
  z: { kind: "range", min: 0, max: 1, step: 0.05, default: 0, label: "zDepth", static: true },
  draw: { kind: "bool", default: true, label: "draw-in", static: true },
} as const satisfies AnySpec

const activeCells = (): Cell[] => [...cells.values()].filter(c => c.page === active || c.page === "*")

function nsSpecs(): Namespaces {
  const out: Namespaces = {}
  for (const c of activeCells()) out[c.id] = { ...c.spec, ...PIN_SPEC }
  return out
}
function nsValues(): NsValues {
  const out: NsValues = {}
  for (const c of activeCells()) out[c.id] = { ...c.values.$(), pin: c.pins.$().pin }
  return out
}

function writeUrl(m: Mode): void {
  if (applying) return
  const specs = nsSpecs()
  const search = mergeSearch(loc.$().search, printSearch(nsValues(), specs), specs)
  written = search
  writeSearch(search, m)
}

// the values written inside fn travel as one history entry of this mode; everything else replaces
export function commit(m: Mode, fn: () => void): void {
  transition(() => {
    mode = m
    try {
      fn()
    } finally {
      mode = "replace"
    }
  })
}

// back / forward and route changes: every active section takes its values from the url again
export function syncFromUrl(search: string): void {
  if (search === written) return
  const specs = nsSpecs()
  const parsed = parseSearch(search, specs)
  applying = true
  try {
    for (const c of activeCells()) {
      const v = parsed[c.id]
      c.values.$(Object.fromEntries(Object.keys(c.spec).map(k => [k, v[k]])))
      c.pins.$({ pin: String(v.pin ?? "") })
    }
  } finally {
    applying = false
  }
  written = search
}

export function setActivePage(page: string, search: string): void {
  active = page
  written = ""
  syncFromUrl(search)
}

export type SectionState<S extends AnySpec> = {
  page: string
  id: string
  spec: S
  presets: Presets<ValuesOf<S>>
  values: Signal<ValuesOf<S>>
  pins: Signal<PinValues>
  states: Signal<Saved[]>
  store: Store
  set(patch: Partial<ValuesOf<S>>, m?: Mode): void
  rollAll(): void
  togglePin(key: string): void
  applyPreset(name: string): void
  save(name: string): void
  load(id: number): void
  star(id: number): void
  remove(id: number): void
}

const made = new Map<string, SectionState<AnySpec>>()

// one section = one url namespace (?<id>.<key>=, ?<id>.pin=) + one localStorage key; values start as defaults, then the autosave, then the url
export function sectionState<S extends AnySpec>(
  page: string,
  id: string,
  spec: S,
  presets: Presets<ValuesOf<S>> = {},
): SectionState<S> {
  const key = `${page}.${id}`
  const hit = made.get(key)
  if (hit) return hit as unknown as SectionState<S>

  const st = store(`${STORAGE}.${key}`)
  const search = loc.$().search
  const urlKeys = new Set(new URLSearchParams(search).keys())
  const fromUrl = parseSearch(search, { [id]: { ...spec, ...PIN_SPEC } })[id]
  const start = { ...defaultsOf(spec), ...parseValues(spec, st.current() ?? {}) } as ValuesOf<S>
  for (const k of Object.keys(spec) as (keyof S & string)[])
    if (urlKeys.has(`${id}.${k}`)) start[k] = fromUrl[k] as never
  const values = Signal<ValuesOf<S>>(start)
  const pins = Signal<PinValues>({
    pin: urlKeys.has(`${id}.pin`) ? String(fromUrl.pin ?? "") : currentPin(`${STORAGE}.${key}`),
  })
  const states = Signal<Saved[]>(st.list())
  cells.set(key, { page, id, spec, values: values as never, pins })

  values.$.pipe(skip(1)).subscribe(v => {
    st.saveCurrent(v, pins.$().pin)
    writeUrl(mode)
  })
  pins.$.pipe(skip(1)).subscribe(p => {
    st.saveCurrent(values.$(), p.pin)
    writeUrl(mode)
  })

  const set = (patch: Partial<ValuesOf<S>>, m: Mode = "replace") =>
    commit(m, () => values.$({ ...values.$(), ...patch }))
  const state: SectionState<S> = {
    page,
    id,
    spec,
    presets,
    values,
    pins,
    states,
    store: st,
    set,
    rollAll: () => commit("push", () => values.$(shuffle(spec, values.$(), mulberry32(freshSeed()), pinSet(pins.$())))),
    togglePin(k) {
      const p = pinSet(pins.$())
      if (p.has(k)) p.delete(k)
      else p.add(k)
      commit("replace", () => pins.$({ pin: pinText(p) }))
    },
    applyPreset(name) {
      const p = presets[name]
      if (p) set(p, "push")
    },
    save(name) {
      st.add(name, values.$(), pins.$().pin)
      states.$(st.list())
    },
    load(sid) {
      const s = st.list().find(x => x.id === sid)
      if (!s) return
      commit("push", () => {
        values.$({ ...values.$(), ...(s.vals as Partial<ValuesOf<S>>) })
        pins.$({ pin: s.pin })
      })
    },
    star(sid) {
      st.star(sid)
      states.$(st.list())
    },
    remove(sid) {
      st.remove(sid)
      states.$(st.list())
    },
  }
  made.set(key, state as unknown as SectionState<AnySpec>)
  return state
}

export const pageState = (): SectionState<typeof PAGE_SPEC> => sectionState("*", "page", PAGE_SPEC)
export const zDepth = (): number => pageState().values.$().z
export const drawIn = (): boolean => pageState().values.$().draw
