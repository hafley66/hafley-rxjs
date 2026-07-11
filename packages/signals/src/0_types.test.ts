import { describe, it, expect } from 'vitest'
import { Signal } from './2_Signal'
import { trackSubscription } from '../../../vitest.setup'

describe('Signal', () => {
  it('should create a signal with initial state', () => {
    const count = Signal({ value: 0 })
    expect(count.$()).toEqual({ value: 0 })
  })

  it('should read nested values', () => {
    const state = Signal({ user: { name: 'chris', age: 30 } })
    expect(state.user.name.$()).toBe('chris')
    expect(state.user.age.$()).toBe(30)
  })

  it('should write nested values', () => {
    const state = Signal({ user: { name: 'chris' } })
    state.user.name.$('alice')
    expect(state.user.name.$()).toBe('alice')
  })

  it('should propagate nullish values', () => {
    const state = Signal({ user: null as any })
    // When user is null, accessing nested properties should return undefined
    expect(state.user?.name?.$()?.$()).toBeUndefined()
  })

  it('should subscribe to changes', () => {
    return new Promise<void>((resolve) => {
      const count = Signal({ value: 0 })
      let emissionCount = 0

      trackSubscription(
        count.$.subscribe(() => {
          emissionCount++
          if (emissionCount === 2) {
            resolve()
          }
        })
      )

      count.$({ value: 1 })
    })
  })

  it('should emit on nested writes', () => {
    return new Promise<void>((resolve) => {
      const state = Signal({ user: { name: 'chris' } })
      const values: string[] = []

      trackSubscription(
        state.user.name.$.subscribe((name) => {
          values.push(name)
          if (values.length === 2) {
            expect(values).toEqual(['chris', 'alice'])
            resolve()
          }
        })
      )

      state.user.name.$('alice')
    })
  })
})
