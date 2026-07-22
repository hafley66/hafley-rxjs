import { filter, map, scan, type Observable } from 'rxjs'
import type { NumberInput, Total } from './0_models'

export function runningTotalHandwritten(inputs: { value: Observable<NumberInput> }): Observable<Total> {
  return inputs.value.pipe(
    map((value) => value * 2),
    filter((value) => value >= 4),
    scan((state: Total, value) => state + value, 0 as Total),
  )
}
