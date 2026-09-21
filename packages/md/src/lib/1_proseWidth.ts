// Pure prose-width math. The markdown panel stores pixels so the reading
// column stays stable when a document or the surrounding dock changes.

export const DEFAULT_PROSE_WIDTH = 900
export const DEFAULT_PROSE_WIDTH_MIN = 420
export const DEFAULT_PROSE_WIDTH_MAX = 1200

// These outer limits keep editable bounds useful on both a narrow dock and a
// wide monitor. The user-facing min/max fields remain free to choose any
// values inside this range.
export const ABSOLUTE_PROSE_WIDTH_MIN = 240
export const ABSOLUTE_PROSE_WIDTH_MAX = 2400

export interface ProseWidthBounds {
  min: number
  max: number
}

export const DEFAULT_PROSE_WIDTH_BOUNDS: ProseWidthBounds = {
  min: DEFAULT_PROSE_WIDTH_MIN,
  max: DEFAULT_PROSE_WIDTH_MAX,
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}

function integerOr(value: number, fallback: number): number {
  return Math.round(finiteOr(value, fallback))
}

export function normalizeProseWidthBounds(
  bounds: Partial<ProseWidthBounds> | undefined,
): ProseWidthBounds {
  const min = Math.min(
    ABSOLUTE_PROSE_WIDTH_MAX,
    Math.max(
      ABSOLUTE_PROSE_WIDTH_MIN,
      integerOr(bounds?.min ?? DEFAULT_PROSE_WIDTH_MIN, DEFAULT_PROSE_WIDTH_MIN),
    ),
  )
  const max = Math.min(
    ABSOLUTE_PROSE_WIDTH_MAX,
    Math.max(min, integerOr(bounds?.max ?? DEFAULT_PROSE_WIDTH_MAX, DEFAULT_PROSE_WIDTH_MAX)),
  )
  return { min, max }
}

export function clampProseWidth(value: number, bounds: ProseWidthBounds): number {
  const normalized = normalizeProseWidthBounds(bounds)
  return Math.min(normalized.max, Math.max(normalized.min, integerOr(value, DEFAULT_PROSE_WIDTH)))
}
