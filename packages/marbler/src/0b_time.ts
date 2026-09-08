// Duration formatting only: no DOM, no signals. Marbler and report-shell share this one helper so
// a single report never mixes "384796875 ms" with "4d 11h", and no column has to be widened to fit.
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

// "0ms" | "0.19ms" (sub-millisecond but non-zero) | "14ms" | "1.2s" (<10s) | "14s" | "2m 10s" |
// "1h 4m" | "2d 3h". Negative input reads as zero: a clock skew is not a negative duration.
export function formatDuration(ms: number): string {
  const value = Math.max(0, ms)
  if (value <= 0) return "0ms"
  if (value < 1) return `${value.toFixed(2)}ms`
  if (value < SECOND) return `${Math.round(value)}ms`
  if (value < 10 * SECOND) return `${(value / SECOND).toFixed(1)}s`
  if (value < MINUTE) return `${Math.round(value / SECOND)}s`
  if (value < HOUR) return twoUnit(value, MINUTE, SECOND, "m", "s")
  if (value < DAY) return twoUnit(value, HOUR, MINUTE, "h", "m")
  return twoUnit(value, DAY, HOUR, "d", "h")
}
