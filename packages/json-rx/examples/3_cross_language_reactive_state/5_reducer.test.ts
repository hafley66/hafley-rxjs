import { Subject } from 'rxjs'
import { describe, expect, test } from 'vitest'
import { createLifecycleStateSignal, initialLifecycleState, reduceLifecycleState, type LifecycleStateEvent } from './4_reducer.auto'
import timeline from './3_timeline.json'
describe('generated reactive state reducer', () => { test('matches every canonical lifecycle state', () => { const states = timeline.events.reduce((all, event) => [...all, reduceLifecycleState(all.at(-1) ?? initialLifecycleState, event as LifecycleStateEvent)], [] as typeof initialLifecycleState[]); expect(states).toEqual(timeline.states) }) })
describe('generated lifecycle signal', () => { test('retains current state for two observers and releases its owner', () => { const events = new Subject<LifecycleStateEvent>(); const owner = createLifecycleStateSignal(events); const first: string[] = []; const second: string[] = []; const firstSub = owner.state.$.subscribe((state) => first.push(state.status)); const secondSub = owner.state.$.subscribe((state) => second.push(state.status)); events.next({ kind: 'loading' }); firstSub.unsubscribe(); events.next({ kind: 'finalize' }); owner.dispose(); secondSub.unsubscribe(); expect({ first, second, active: owner.metrics.active() }).toMatchInlineSnapshot(`
  {
    "active": 0,
    "first": [
      "idle",
      "loading",
    ],
    "second": [
      "idle",
      "loading",
      "finalize",
    ],
  }
`) }) })
