// Millisecond formatting, no DOM, no signals: one concern per AGENTS.md's src/lib rule.
const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

// major/minor pair (e.g. "2m 10s"), carrying into the major unit on a minor rounding overflow.
function twoUnit(value: number, majorMs: number, minorMs: number, majorLabel: string, minorLabel: string): string {
  const major = Math.floor(value / majorMs)
  const minor = Math.round((value % majorMs) / minorMs)
  const minorSpan = Math.round(majorMs / minorMs)
  if (minor >= minorSpan) return `${major + 1}${majorLabel} 0${minorLabel}`
  return `${major}${majorLabel} ${minor}${minorLabel}`
}

// "0ms" | "14ms" | "1.2s" (<10s) | "14s" | "2m 10s" | "1h 4m" | "2d 3h"
export function formatDuration(ms: number): string {
  const value = Math.max(0, ms)
  if (value < 1) return '0ms'
  if (value < SECOND) return `${Math.round(value)}ms`
  if (value < 10 * SECOND) return `${(value / SECOND).toFixed(1)}s`
  if (value < MINUTE) return `${Math.round(value / SECOND)}s`
  if (value < HOUR) return twoUnit(value, MINUTE, SECOND, 'm', 's')
  if (value < DAY) return twoUnit(value, HOUR, MINUTE, 'h', 'm')
  return twoUnit(value, DAY, HOUR, 'd', 'h')
}

// "14s ago" | "2m ago" | "1h 4m ago" | "3d ago"; floored so a live clock never reads ahead.
export function formatAge(ms: number, now: number = Date.now()): string {
  const elapsed = Math.max(0, now - ms)
  if (elapsed < MINUTE) return `${Math.floor(elapsed / SECOND)}s ago`
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`
  if (elapsed < DAY) {
    const hours = Math.floor(elapsed / HOUR)
    const minutes = Math.floor((elapsed % HOUR) / MINUTE)
    return `${hours}h ${minutes}m ago`
  }
  const days = Math.floor(elapsed / DAY)
  return `${days}d ago`
}
