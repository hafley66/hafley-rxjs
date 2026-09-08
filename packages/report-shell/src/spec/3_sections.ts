import { localStorageAdapter, Signal } from "@hafley66/signals"
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
  rollField,
  shuffle,
  type ValuesOf,
} from "./0_spec.js"
import { type Mode, mergeSearch, type Namespaces, type NsValues, parseSearch, printSearch } from "./1_url.js"
import { type Saved, type StorageFor, type Store, store } from "./2_store.js"

// what an app hands the kit: its query string, a history writer, a storage factory, an optional view-transition wrapper
export type SectionHost = {
  search(): string
  write(search: string, mode: Mode): void
  storage?: StorageFor
  transition?(fn: () => void): void
  prefix?: string
}

export type SectionState<S extends AnySpec> = {
  page: string
  id: string
  spec: S
  presets: Presets<ValuesOf<S>>
  values: Signal<ValuesOf<S>>
  pins: Signal<PinValues>
  states: Signal<Saved[]>
  selected: Signal<number | null>
  store: Store
  set(patch: Partial<ValuesOf<S>>, m?: Mode): void
  rollAll(): void
  roll(key: string): void
  togglePin(key: string): void
  applyPreset(name: string): void
  save(name: string): void
  load(id: number): void
  select(id: number | null): void
  star(id: number): void
  remove(id: number): void
}

export type Sections = {
  sectionState<S extends AnySpec>(page: string, id: string, spec: S, presets?: Presets<ValuesOf<S>>): SectionState<S>
  setActivePage(page: string, search: string): void
  syncFromUrl(search: string): void
  commit(mode: Mode, fn: () => void): void
  activeSearch(): string
  // every mounted section of the active page plus the "*" page cells
  activeStates(): SectionState<AnySpec>[]
  // one push: every active section rolls its unpinned, non-static fields from one seeded rng
  shuffleAll(): void
}

type Cell = {
  page: string
  id: string
  spec: AnySpec
  values: Signal<Record<string, unknown>>
  pins: Signal<PinValues>
}

// page "*" cells belong to every page (a page-global namespace such as ?page.z)
export function createSections(host: SectionHost): Sections {
  const storage: StorageFor = host.storage ?? localStorageAdapter
  const transition = host.transition ?? ((fn: () => void) => fn())
  const prefix = host.prefix ?? "kit"
  const cells = new Map<string, Cell>()
  const made = new Map<string, SectionState<AnySpec>>()
  let active = ""
  let applying = false
  let written = ""
  let mode: Mode = "replace"
  let depth = 0
  let pending = false

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

  // inside a commit every signal write is folded into one url write at its end
  function writeUrl(m: Mode): void {
    if (applying) return
    if (depth > 0) {
      pending = true
      return
    }
    const specs = nsSpecs()
    const search = mergeSearch(host.search(), printSearch(nsValues(), specs), specs)
    written = search
    host.write(search, m)
  }

  // the values written inside fn travel as one history entry of this mode; everything else replaces.
  // Nested commits fold into the outermost one.
  function commit(m: Mode, fn: () => void): void {
    transition(() => {
      const prev = mode
      mode = m
      depth++
      try {
        fn()
      } finally {
        depth--
        mode = prev
        if (depth === 0 && pending) {
          pending = false
          writeUrl(m)
        }
      }
    })
  }

  // back / forward and route changes: every active section takes its values from the url again
  function syncFromUrl(search: string): void {
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

  function setActivePage(page: string, search: string): void {
    active = page
    written = ""
    syncFromUrl(search)
  }

  // one section = one url namespace (?<id>.<key>=, ?<id>.pin=) + one storage key; values start as defaults, then the autosave, then the url
  function sectionState<S extends AnySpec>(
    page: string,
    id: string,
    spec: S,
    presets: Presets<ValuesOf<S>> = {},
  ): SectionState<S> {
    const key = `${page}.${id}`
    const hit = made.get(key)
    if (hit) return hit as unknown as SectionState<S>

    const st = store(`${prefix}.${key}`, storage)
    const search = host.search()
    const urlKeys = new Set(new URLSearchParams(search).keys())
    const fromUrl = parseSearch(search, { [id]: { ...spec, ...PIN_SPEC } })[id]
    const saved = st.current.$()
    const start = { ...defaultsOf(spec), ...parseValues(spec, saved?.vals ?? {}) } as ValuesOf<S>
    for (const k of Object.keys(spec) as (keyof S & string)[])
      if (urlKeys.has(`${id}.${k}`)) start[k] = fromUrl[k] as never
    const values = Signal<ValuesOf<S>>(start)
    const pins = Signal<PinValues>({
      pin: urlKeys.has(`${id}.pin`) ? String(fromUrl.pin ?? "") : (saved?.pin ?? ""),
    })
    const { states, selected } = st
    cells.set(key, { page, id, spec, values: values as never, pins })

    // every edit lands in the autosave and, when a named state is selected, in that state too
    const persist = (v: ValuesOf<S>, pin: string) => {
      st.saveCurrent(v, pin)
      const sid = selected.$()
      if (sid !== null && states.$().some(x => x.id === sid)) st.update(sid, v, pin)
    }
    values.$.pipe(skip(1)).subscribe(v => {
      persist(v, pins.$().pin)
      writeUrl(mode)
    })
    pins.$.pipe(skip(1)).subscribe(p => {
      persist(values.$(), p.pin)
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
      selected,
      store: st,
      set,
      rollAll: () =>
        commit("push", () => values.$(shuffle(spec, values.$(), mulberry32(freshSeed()), pinSet(pins.$())))),
      roll: k => set({ [k]: rollField(spec[k], mulberry32(freshSeed())) } as Partial<ValuesOf<S>>, "push"),
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
      // save = create or overwrite by name, then that state receives every later edit
      save(name) {
        const hit = st.byName(name)
        if (hit) st.update(hit.id, values.$(), pins.$().pin)
        const s = hit ?? st.add(name, values.$(), pins.$().pin)
        st.select(s.id)
      },
      load(sid) {
        const s = states.$().find(x => x.id === sid)
        if (!s) return
        commit("push", () => {
          values.$({ ...values.$(), ...(s.vals as Partial<ValuesOf<S>>) })
          pins.$({ pin: s.pin })
        })
        st.select(sid)
      },
      select: sid => st.select(sid),
      star: sid => st.star(sid),
      remove: sid => st.remove(sid),
    }
    made.set(key, state as unknown as SectionState<AnySpec>)
    return state
  }

  const activeStates = (): SectionState<AnySpec>[] =>
    [...made.values()].filter(s => s.page === active || s.page === "*")
  const shuffleAll = (): void =>
    commit("push", () => {
      const rng = mulberry32(freshSeed())
      for (const s of activeStates()) s.values.$(shuffle(s.spec, s.values.$(), rng, pinSet(s.pins.$())))
    })

  return { sectionState, setActivePage, syncFromUrl, commit, activeSearch: () => written, activeStates, shuffleAll }
}
