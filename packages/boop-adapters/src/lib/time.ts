// Age/duration text for the nav rows and Title line. A local, small formatter: report-shell is
// growing its own time.ts concurrently, but this package does not depend on that work mid-flight.
const SECOND_MS = 1000
const MINUTE_MS = 60 * SECOND_MS
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

export function formatAge(ts: number, now: number): string {
  const diff = Math.max(0, now - ts)
  if (diff < MINUTE_MS) return `${Math.floor(diff / SECOND_MS)}s ago`
  if (diff < HOUR_MS) return `${Math.floor(diff / MINUTE_MS)}m ago`
  if (diff < DAY_MS) {
    const hours = Math.floor(diff / HOUR_MS)
    const minutes = Math.floor((diff % HOUR_MS) / MINUTE_MS)
    return minutes ? `${hours}h ${minutes}m ago` : `${hours}h ago`
  }
  return `${Math.floor(diff / DAY_MS)}d ago`
}

export function formatDuration(ms: number): string {
  const value = Math.max(0, ms)
  if (value < MINUTE_MS) return `${Math.floor(value / SECOND_MS)}s`
  if (value < HOUR_MS) {
    const minutes = Math.floor(value / MINUTE_MS)
    const seconds = Math.floor((value % MINUTE_MS) / SECOND_MS)
    return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`
  }
  const hours = Math.floor(value / HOUR_MS)
  const minutes = Math.floor((value % HOUR_MS) / MINUTE_MS)
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`
}
