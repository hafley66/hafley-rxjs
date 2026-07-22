import { Subject } from 'rxjs'
import { describe, expect, test, vi } from 'vitest'
import type { DelayedRequest, ResultId } from './0_models'
import { latestResult, type ResultIdMetrics } from './4_pipeline.auto'
import timeline from './3_timeline.json'

describe('generated RxJS switchMap', () => {
  test('replaces A with B and releases its timer', async () => {
    vi.useFakeTimers()
    try {
      const request = new Subject<DelayedRequest>()
      const metrics: ResultIdMetrics = { active: 0, cancellations: 0 }
      const states: ResultId[] = []
      latestResult({ request }, metrics).subscribe((state) => states.push(state))

      let at = 0
      for (const event of timeline.events) {
        await vi.advanceTimersByTimeAsync(event.at - at)
        request.next(event.value)
        at = event.at
      }
      await vi.advanceTimersByTimeAsync(timeline.settleAt - at)

      expect({ states, metrics }).toMatchInlineSnapshot(`
        {
          "metrics": {
            "active": 0,
            "cancellations": 1,
          },
          "states": [
            "B",
          ],
        }
      `)
    } finally {
      vi.useRealTimers()
    }
  })
})
