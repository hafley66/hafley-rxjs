import { describe, expect, it } from 'vitest'
import { Signal } from '@hafley66/signals'
import { createMarbler, type MarbleEvent } from '@hafley66/marbler'
import { syncMarbler } from './marblerSync'

const ev = (id: string, start: number, duration: number): MarbleEvent =>
  ({ id, name: id, method: '', status: 0, type: 'x', initiator: '', size: '', start, duration, from: '', to: '', preview: '', phases: [] })

describe('syncMarbler', () => {
  it('refits on a new selection, keeps the viewport otherwise, and stops after unsubscribe', () => {
    const events = Signal<MarbleEvent[]>([ev('a', 0, 100)])
    const selection = Signal<string | null>('a')
    const marbler = createMarbler(events.$())
    const sub = syncMarbler(marbler, events.$, selection)

    marbler.viewport.$({ ...marbler.viewport.$(), visible: [10, 20], followLive: false })
    events.$([ev('a', 0, 100), ev('b', 50, 10)])
    expect(marbler.viewport.$().visible).toEqual([10, 20])

    selection.$('b')
    events.$([ev('b', 50, 10)])
    expect(marbler.viewport.$().visible).toEqual([50, 60])
    expect(marbler.source.$().map((e) => e.id)).toEqual(['b'])

    sub.unsubscribe()
    events.$([ev('c', 0, 1)])
    expect(marbler.source.$().map((e) => e.id)).toEqual(['b'])
  })
})
