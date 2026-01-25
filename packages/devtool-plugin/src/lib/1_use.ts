import { useEffect, useState } from "react"

export const use$ = <T>(
  observable: { subscribe(cbk: (it: T) => void): { unsubscribe(): void } },
  defaultValue: T,
): T => {
  const [value, forceUpdate] = useState(defaultValue)

  useEffect(() => {
    const sub = observable.subscribe(next => forceUpdate(next))
    return () => sub.unsubscribe()
  }, [observable])

  return value ?? defaultValue
}
