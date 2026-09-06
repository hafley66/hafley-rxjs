// Small display formatters shared by nav row columns.
const THOUSANDS = /\B(?=(\d{3})+(?!\d))/g

export function formatTokens(n: number): string {
  return Math.round(n).toString().replace(THOUSANDS, ",")
}

export function lastPathSegment(path: string | null): string {
  if (!path) return ""
  const segments = path.split("/").filter(Boolean)
  return segments.at(-1) ?? ""
}

export function shortId(id: string): string {
  return id.length > 20 && /^[0-9a-f-]+$/i.test(id) ? `${id.slice(0, 8)}…` : id
}
