import { describe, it, expect, expectTypeOf } from 'vitest'
import { Signal } from './2_Signal'
import type { SignalPath, SignalPathValue } from './0_types'
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

// An interface, because `IsRecursive` calls one a leaf and `SignalPath` has to walk it anyway.
interface Row {
  readonly id: string
  readonly user: { readonly city: string; readonly zip?: number }
  readonly tags: readonly string[]
  readonly born: Date
  readonly kids?: readonly Row[]
}

describe('SignalPath', () => {
  it('should accept a dotted path into an interface', () => {
    expectTypeOf<'user.city'>().toMatchTypeOf<SignalPath<Row>>()
    expectTypeOf<'id'>().toMatchTypeOf<SignalPath<Row>>()
    expect(true).toBe(true)
  })

  it('should accept a numeric segment for an array seat', () => {
    expectTypeOf<'tags.0'>().toMatchTypeOf<SignalPath<Row>>()
    expectTypeOf<'kids.2.user.city'>().toMatchTypeOf<SignalPath<Row>>()
    expect(true).toBe(true)
  })

  it('should reject a key the type does not carry', () => {
    // @ts-expect-error `citty` is a typo
    const typo: SignalPath<Row> = 'user.citty'
    // @ts-expect-error a Date is a leaf, so its methods are not addressable
    const method: SignalPath<Row> = 'born.getTime'
    expect([typo, method]).toHaveLength(2)
  })

  it('should stop at a primitive rather than offering its members', () => {
    // @ts-expect-error `length` belongs to the string, not to the row
    const member: SignalPath<Row> = 'id.length'
    expect(member).toBe('id.length')
  })

  it('should bound a self-recursive type by DepthLimit', () => {
    expectTypeOf<'kids.0.kids.1.id'>().toMatchTypeOf<SignalPath<Row>>()
    // @ts-expect-error six hops is past the default depth of five
    const past: SignalPath<Row> = 'kids.0.kids.1.kids.2.kids.3.kids.4.kids.5.id'
    expect(past).toContain('kids')
  })
})

describe('SignalPathValue', () => {
  it('should give the value at a dotted path', () => {
    expectTypeOf<SignalPathValue<Row, 'user.city'>>().toEqualTypeOf<string>()
    expectTypeOf<SignalPathValue<Row, 'born'>>().toEqualTypeOf<Date>()
    expect(true).toBe(true)
  })

  it('should carry the undefined an optional hop introduces', () => {
    expectTypeOf<SignalPathValue<Row, 'user.zip'>>().toEqualTypeOf<number | undefined>()
    expectTypeOf<SignalPathValue<Row, 'kids.0.id'>>().toEqualTypeOf<string | undefined>()
    expect(true).toBe(true)
  })
})
