export type Saved = { id: number; name: string; star: boolean; vals: Record<string, unknown>; pin: string }
export type Store = {
  current(): Record<string, unknown> | null
  saveCurrent(vals: Record<string, unknown>, pin: string): void
  list(): Saved[]
  add(name: string, vals: Record<string, unknown>, pin: string): Saved
  star(id: number): void
  remove(id: number): void
}

type Kv = Pick<globalThis.Storage, "getItem" | "setItem">

const get = <T>(ls: Kv, k: string): T | null => {
  try {
    return JSON.parse(ls.getItem(k) || "null") as T | null
  } catch {
    return null
  }
}
const set = (ls: Kv, k: string, v: unknown) => ls.setItem(k, JSON.stringify(v))

// key = "<prefix>.<page>.<section>": ".current" autosaves the live values, ".states" holds the named list
export function store(key: string, ls: Kv = localStorage): Store {
  const ck = `${key}.current`
  const sk = `${key}.states`
  const list = () => get<Saved[]>(ls, sk) ?? []
  const put = (states: Saved[]) => set(ls, sk, states)
  return {
    current: () => get<{ vals: Record<string, unknown> }>(ls, ck)?.vals ?? null,
    saveCurrent: (vals, pin) => set(ls, ck, { vals, pin }),
    list,
    add(name, vals, pin) {
      const states = list()
      const s: Saved = {
        id: Math.max(Date.now(), ...states.map(x => x.id + 1)),
        name: name.trim() || `state ${states.length + 1}`,
        star: false,
        vals,
        pin,
      }
      put([...states, s])
      return s
    },
    star(id) {
      put(list().map(s => (s.id === id ? { ...s, star: !s.star } : s)))
    },
    remove(id) {
      put(list().filter(s => s.id !== id))
    },
  }
}

export const currentPin = (key: string, ls: Kv = localStorage): string =>
  get<{ pin?: string }>(ls, `${key}.current`)?.pin ?? ""
