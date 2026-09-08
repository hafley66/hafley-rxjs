// Millisecond formatting, no DOM, no signals: one concern per AGENTS.md's src/lib rule.
// formatDuration is marbler's, re-exported so the marbler panel and the report tables agree.
export { formatDuration } from '@hafley66/marbler'

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

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
