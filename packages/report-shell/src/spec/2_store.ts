import { type Signal, type Storage, storageSignal } from "@hafley66/signals"
import { concat, defer, of, Subject } from "rxjs"

export type Saved = { id: number; name: string; star: boolean; vals: Record<string, unknown>; pin: string }
export type Current = { vals: Record<string, unknown>; pin: string }

// three signals bound to three Storage<string> backends under "<key>.current|states|selected"
export type Store = {
  current: Signal<Current | null>
  states: Signal<Saved[]>
  selected: Signal<number | null>
  saveCurrent(vals: Record<string, unknown>, pin: string): void
  add(name: string, vals: Record<string, unknown>, pin: string): Saved
  star(id: number): void
  remove(id: number): void
  update(id: number, vals: Record<string, unknown>, pin: string): void
  byName(name: string): Saved | undefined
  select(id: number | null): void
}

export type StorageFor = (key: string) => Storage<string>

// key = "<prefix>.<page>.<section>": ".current" autosaves the live values, ".states" holds the named list,
// ".selected" is the id of the named state that receives every edit (null = only the autosave does)
export function store(key: string, storage: StorageFor): Store {
  const current = storageSignal<Current | null>(storage(`${key}.current`), null)
  const states = storageSignal<Saved[]>(storage(`${key}.states`), [])
  const selected = storageSignal<number | null>(storage(`${key}.selected`), null)
  const list = () => states.$()
  const put = (next: Saved[]) => states.$(next)
  return {
    current,
    states,
    selected,
    saveCurrent: (vals, pin) => current.$({ vals, pin }),
    add(name, vals, pin) {
      const all = list()
      const s: Saved = {
        id: Math.max(Date.now(), ...all.map(x => x.id + 1)),
        name: name.trim() || `state ${all.length + 1}`,
        star: false,
        vals,
        pin,
      }
      put([...all, s])
      return s
    },
    star(id) {
      put(list().map(s => (s.id === id ? { ...s, star: !s.star } : s)))
    },
    remove(id) {
      put(list().filter(s => s.id !== id))
      if (selected.$() === id) selected.$(null)
    },
    update(id, vals, pin) {
      put(list().map(s => (s.id === id ? { ...s, vals, pin } : s)))
    },
    byName: name => list().find(s => s.name === name.trim()),
    select: id => selected.$(id),
  }
}

// in-memory Storage<string> per key for tests and hosts without localStorage.
// write.next stores silently, like localStorage; set() is an outside writer (another tab) and emits on read
export type MemoryStorage = StorageFor & {
  get(key: string): string | undefined
  set(key: string, value: string): void
  keys(): string[]
}
export function memoryStorage(): MemoryStorage {
  const values = new Map<string, string>()
  const changes = new Map<string, Subject<string>>()
  const bus = (key: string) => {
    const hit = changes.get(key)
    if (hit) return hit
    const s = new Subject<string>()
    changes.set(key, s)
    return s
  }
  const make: StorageFor = key => ({
    read: defer(() => concat(of(values.get(key) ?? ""), bus(key))),
    write: { next: v => void values.set(key, v), error() {}, complete() {} },
  })
  return Object.assign(make, {
    get: (key: string) => values.get(key),
    set(key: string, value: string) {
      values.set(key, value)
      bus(key).next(value)
    },
    keys: () => [...values.keys()],
  })
}
