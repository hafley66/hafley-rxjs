import { Observable } from "rxjs"
import { scan } from "rxjs/internal/operators/scan"
import { startWith } from "rxjs/internal/operators/startWith"

export function scanEager<Event, State>(acc: (sum: State, next: Event) => State, defaultValue: State) {
  return (source$: Observable<Event>) => source$.pipe(scan(acc, defaultValue), startWith(defaultValue))
}
