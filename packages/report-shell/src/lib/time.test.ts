import { describe, expect, it } from 'vitest'
import { formatAge, formatDuration } from './time'

describe('formatDuration', () => {
  it('keeps two decimals for a sub-millisecond duration, exact zero stays 0ms', () => {
    expect(formatDuration(0)).toBe('0ms')
    expect(formatDuration(0.4)).toBe('0.40ms')
  })

  it('shows whole milliseconds under 1s', () => {
    expect(formatDuration(14)).toBe('14ms')
    expect(formatDuration(999)).toBe('999ms')
  })

  it('shows one decimal of seconds under 10s', () => {
    expect(formatDuration(1200)).toBe('1.2s')
    expect(formatDuration(9999)).toBe('10.0s')
  })

  it('shows whole seconds from 10s to under a minute', () => {
    expect(formatDuration(14000)).toBe('14s')
    expect(formatDuration(59000)).toBe('59s')
  })

  it('shows minutes and seconds from a minute to under an hour', () => {
    expect(formatDuration(130000)).toBe('2m 10s')
    expect(formatDuration(60000)).toBe('1m 0s')
  })

  it('carries seconds into minutes on a rounding overflow', () => {
    expect(formatDuration(119999)).toBe('2m 0s')
  })

  it('shows hours and minutes from an hour to under a day', () => {
    expect(formatDuration(3_840_000)).toBe('1h 4m')
  })

  it('shows days and hours from a day up', () => {
    expect(formatDuration(183_600_000)).toBe('2d 3h')
  })

  it('clamps negative durations to 0ms', () => {
    expect(formatDuration(-50)).toBe('0ms')
  })
})

describe('formatAge', () => {
  const now = Date.UTC(2026, 0, 1)

  it('shows whole seconds under a minute', () => {
    expect(formatAge(now - 14_000, now)).toBe('14s ago')
  })

  it('shows whole minutes under an hour, no seconds', () => {
    expect(formatAge(now - 120_000, now)).toBe('2m ago')
  })

  it('shows hours and minutes under a day', () => {
    expect(formatAge(now - 3_840_000, now)).toBe('1h 4m ago')
  })

  it('shows whole days from a day up, no hours', () => {
    expect(formatAge(now - 259_200_000, now)).toBe('3d ago')
  })

  it('clamps a timestamp in the future to 0s ago', () => {
    expect(formatAge(now + 5_000, now)).toBe('0s ago')
  })

  it('defaults now to Date.now() when omitted', () => {
    const recent = Date.now() - 1000
    expect(formatAge(recent)).toBe('1s ago')
  })
})
