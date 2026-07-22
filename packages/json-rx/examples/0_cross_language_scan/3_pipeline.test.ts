import { Subject } from 'rxjs'
import { describe, expect, test } from 'vitest'
import type { UsageSnapshot, UsageUpdate } from './0_models'
import { usageState } from './2_pipeline.auto'
import timeline from './4_timeline.json'

type TimelineEvent =
  | { source: 'snapshot'; value: UsageSnapshot }
  | { source: 'update'; value: UsageUpdate }

describe('generated RxJS usage state', () => {
  test('matches the canonical cross-language event timeline', () => {
    const snapshot = new Subject<UsageSnapshot>()
    const update = new Subject<UsageUpdate>()
    const values: UsageSnapshot[] = []
    usageState({ snapshot, update }).subscribe((value) => values.push(value))

    for (const event of timeline.events as TimelineEvent[]) {
      if (event.source === 'snapshot') snapshot.next(event.value)
      else update.next(event.value)
    }

    expect(values).toEqual(timeline.states)
  })
})
