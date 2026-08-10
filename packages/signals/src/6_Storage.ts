import { Observable, type Observer } from "rxjs"
import { Signal } from "./2_Signal.js"
import type { Signal as SignalType } from "./0_types.js"

// Duplex observable channel: values out over time (read, async-safe), in via
// write.next (persist). localStorage/URL/chrome.storage impl this trait.
export interface Storage<T> {
  read: Observable<T>
  write: Observer<T>
}

export type StorageOptions<T> = {
  serialize?: (value: T) => string
  parse?: (value: string) => T
}

// Bind a signal to any Storage<string> backend; devalue-ready via {serialize, parse}.
export function storageSignal<T>(
  backend: Storage<string>,
  fallback: T,
  options: StorageOptions<T> = {},
): SignalType<T> {
  const serialize = options.serialize ?? JSON.stringify
  const parse = options.parse ?? JSON.parse
  const decode = (raw: string | null): T => {
    if (raw == null || raw === "") return fallback
    try { return parse(raw) } catch { return fallback }
  }

  // Seed synchronously from the backend's first read, then track live changes.
  let seed = fallback
  const seedSub = backend.read.subscribe(raw => { seed = decode(raw) })
  seedSub.unsubscribe()

  const signal = Signal<T>(seed)
  signal.$.subscribe(value => backend.write.next(serialize(value)))
  backend.read.subscribe(raw => {
    const next = decode(raw)
    if (next !== signal.$()) signal.$(next)
  })
  return signal
}

// localStorage adapter: the convenience default.
export function localStorageAdapter(key: string): Storage<string> {
  return {
    read: new Observable<string>(subscriber => {
      const emit = () => subscriber.next(localStorage.getItem(key) ?? "")
      addEventListener("storage", (event: StorageEvent) => {
        if (event.storageArea === localStorage && event.key === key) emit()
      })
      emit()
    }),
    write: {
      next: value => localStorage.setItem(key, value),
      error() {},
      complete() {},
    },
  }
}

// URL query-param adapter. Browser-only: touches location/history globals.
// write.next uses replaceState so rapid signal changes do not spam history.
export function urlAdapter(key: string): Storage<string> {
  return {
    read: new Observable<string>(subscriber => {
      const emit = () => subscriber.next(new URLSearchParams(location.search).get(key) ?? "")
      addEventListener("popstate", emit)
      emit()
    }),
    write: {
      next: value => {
        const params = new URLSearchParams(location.search)
        if (value === "") params.delete(key)
        else params.set(key, value)
        history.replaceState(null, "", `${location.pathname}?${params.toString()}${location.hash}`)
      },
      error() {},
      complete() {},
    },
  }
}

export function StorageSignal<T>(key: string, fallback: T, options: StorageOptions<T> = {}): SignalType<T> {
  return storageSignal(localStorageAdapter(key), fallback, options)
}
