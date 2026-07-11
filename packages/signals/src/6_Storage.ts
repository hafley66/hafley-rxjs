import { Signal } from "./2_Signal.js"
import type { Signal as SignalType } from "./0_types.js"

export type StorageOptions<T> = {
  storage?: Storage
  serialize?: (value: T) => string
  parse?: (value: string) => T
}

export function StorageSignal<T>(key: string, fallback: T, options: StorageOptions<T> = {}): SignalType<T> {
  const storage = options.storage ?? localStorage
  const serialize = options.serialize ?? JSON.stringify
  const parse = options.parse ?? JSON.parse
  const read = () => {
    const raw = storage.getItem(key)
    if (raw == null) return fallback
    try { return parse(raw) } catch { return fallback }
  }
  const signal = Signal<T>(read()) as SignalType<T>
  let initializing = true
  signal.$.subscribe(value => {
    if (!initializing) storage.setItem(key, serialize(value))
  })
  initializing = false
  addEventListener("storage", (event: StorageEvent) => {
    if (event.storageArea === storage && event.key === key) signal.$(read())
  })
  return signal
}
