import { Subject } from 'rxjs'
import { describe, expect, test } from 'vitest'
import type { NumberInput, Total } from './0_models'
import { runningTotal } from './4_pipeline.auto'
import { runningTotalHandwritten } from './6_handwritten'
import timeline from './3_timeline.json'

describe('generated and handwritten RxJS map, filter, and scan', () => {
  test('match the canonical cross-language event timeline', () => {
    const outputs: Record<string, Total[]> = {}

    for (const [name, pipeline] of Object.entries({ generated: runningTotal, handwritten: runningTotalHandwritten })) {
      const value = new Subject<NumberInput>()
      const states: Total[] = []
      pipeline({ value }).subscribe((state) => states.push(state))

      for (const event of timeline.events) value.next(event.value)

      outputs[name] = states
    }

    expect(outputs).toEqual({ generated: timeline.states, handwritten: timeline.states })
  })
})
