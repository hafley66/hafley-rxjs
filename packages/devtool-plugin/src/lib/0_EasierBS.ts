import { cloneDeep } from "lodash"
import { useEffect, useState } from "react"
import { BehaviorSubject, Observable, Subject, scan, startWith, switchMap, tap } from "rxjs"
import { __withNoTrack } from "~/0_runtime/0_store"

export class EasierBS<T extends {}> extends BehaviorSubject<T> {
  initialValue: T
  safeInitialClone: T
  constructor(initialValue: T) {
    super(initialValue)
    this.initialValue = cloneDeep(initialValue)
    this.safeInitialClone = cloneDeep(this.initialValue)
  }

  set(partial: Partial<T>) {
    return this.next({
      ...this.value,
      ...partial,
    })
  }

  reset$ = __withNoTrack(() => new Subject<null>())

  reset() {
    this.next(this.safeInitialClone)
    return this.reset$.next(null)
  }

  scanEager<Next>(accumulator: (sum: T, next: Next) => T) {
    const initClone = cloneDeep(this.initialValue)
    return (source$: Observable<Next>) => {
      return this.reset$.pipe(
        startWith(null),
        switchMap(() =>
          source$.pipe(
            scan((_sum, next) => accumulator(this.value, next), initClone),
            tap(next => this.next(next)),
            startWith(initClone),
          ),
        ),
      )
    }
  }

  use$ = () => {
    const [, forceUpdate] = useState(0)

    useEffect(() => {
      const sub = this.subscribe(() => forceUpdate(p => p + 1))
      return () => sub.unsubscribe()
    }, [])

    return this.value
  }
}
