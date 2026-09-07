const UNITS = ["B", "KB", "MB", "GB", "TB"]

// "0 B" | "512 B" | "1.5 KB" | "12 MB": one decimal under 10 of a unit, none above
export function formatBytes(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n) || n < 0) return ""
  let v = n
  let i = 0
  while (v >= 1024 && i < UNITS.length - 1) {
    v /= 1024
    i++
  }
  const text = i === 0 ? String(Math.round(v)) : v < 10 ? v.toFixed(1) : String(Math.round(v))
  return `${text} ${UNITS[i]}`
}
