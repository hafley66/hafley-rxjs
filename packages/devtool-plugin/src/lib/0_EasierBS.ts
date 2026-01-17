import { useEffect, useState } from "react"
import { BehaviorSubject, Observable, scan, startWith } from "rxjs"
export class EasierBS<T extends {}> extends BehaviorSubject<T> {
  private _initialValue: T

  constructor(initialValue: T) {
    super(initialValue)
    this._initialValue = initialValue
  }

  set(partial: Partial<T>) {
    return this.next({
      ...this.value,
      ...partial,
    })
  }

  reset() {
    return this.next(structuredClone(this._initialValue))
  }

  scanEager<Next>(accumulator: (sum: T, next: Next) => T) {
    return (source$: Observable<Next>) => {
      return source$.pipe(
        scan((_sum, next) => accumulator(this.value, next), this.value),
        startWith(this.value),
      )
    }
  }

  use$(): T {
    const [, forceUpdate] = useState(0)

    useEffect(() => {
      console.log("hmmm", this.constructor)
      const sub = this.subscribe(() => forceUpdate(n => n + 1))
      return () => sub.unsubscribe()
    }, [])

    return this.value
  }
}
