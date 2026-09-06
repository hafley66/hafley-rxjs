import { describe, expect, it } from 'vitest'
import { Signal, type Storage } from '@hafley66/signals'
import { createNavCollapse, NAV_RAIL_PX } from './navCollapse'

function createMemoryStorage(): Storage<string> {
  let value = ''
  const read = {
    subscribe(next: (value: string) => void) {
      next(value)
      return { unsubscribe: () => {} }
    },
  } as unknown as Storage<string>['read']

  return {
    read,
    write: {
      next: (next: string) => {
        value = next
      },
      error() {},
      complete() {},
    },
  }
}

describe('createNavCollapse', () => {
  it('toggle collapses to the rail width and restores the previous width', () => {
    const track = Signal(380)
    const nav = createNavCollapse(track, createMemoryStorage(), 380)
    expect(nav.collapsed.$()).toBe(false)
    nav.toggle()
    expect(track.$()).toBe(NAV_RAIL_PX)
    expect(nav.collapsed.$()).toBe(true)
    nav.toggle()
    expect(track.$()).toBe(380)
    expect(nav.collapsed.$()).toBe(false)
  })

  it('collapsed follows the track even when something else writes it', () => {
    const track = Signal(380)
    const nav = createNavCollapse(track, createMemoryStorage(), 380)
    track.$(NAV_RAIL_PX)
    expect(nav.collapsed.$()).toBe(true)
  })

  it('remembers a resized width across a collapse/expand cycle', () => {
    const track = Signal(500)
    const nav = createNavCollapse(track, createMemoryStorage(), 380)
    nav.toggle()
    expect(track.$()).toBe(NAV_RAIL_PX)
    nav.toggle()
    expect(track.$()).toBe(500)
  })

  it('falls back to expandedFallback when nothing was ever recorded', () => {
    const track = Signal(NAV_RAIL_PX)
    const nav = createNavCollapse(track, createMemoryStorage(), 300)
    nav.toggle()
    expect(track.$()).toBe(300)
  })
})
