// One sampler for every renderer lab: it walks the declared viewport rather than the drawn content
// bounds, and records the rect it walked so a future drift shows up in the receipt.

// Every renderer lab clears to this color, so a pixel within BACKGROUND_DISTANCE_SQUARED of it is unpainted.
export const VISUAL_VALIDITY_BACKGROUND_COLOR = 0x10141c

// Squared RGB distance from the sampled background above which a pixel counts as painted.
export const BACKGROUND_DISTANCE_SQUARED = 400

// A frame with fewer painted pixels than this is treated as a failed render.
export const MINIMUM_NON_BACKGROUND_PIXELS = 500

// The viewport both lanes declare in playwright.config.ts at deviceScaleFactor 1.
export const VISUAL_VALIDITY_VIEWPORT = { width: 800, height: 600 } as const

export type SampleRect = { x: number; y: number; width: number; height: number }

export type PixelReadback = {
  pixels: Uint8ClampedArray | Uint8Array
  width: number
  height: number
}

export type VisualValidity = {
  valid: boolean
  totalPixels: number
  nonBackgroundPixels: number
  coverageRatio: number
  drawnNodeCount: number
  drawnEdgeCount: number
  actualBackend: string
  requestedRenderer: string
  sampleRect: SampleRect
}

export type VisualValidityInput = {
  readback: PixelReadback
  drawnNodeCount: number
  drawnEdgeCount: number
  actualBackend: string
  requestedRenderer: string
  viewport?: { width: number; height: number }
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value))
}

// The rect the sampler walks: the declared viewport, clipped to whatever the readback actually holds.
export function sampleRectOf(readback: PixelReadback, viewport: { width: number; height: number } = VISUAL_VALIDITY_VIEWPORT): SampleRect {
  return {
    x: 0,
    y: 0,
    width: Math.max(0, Math.min(readback.width, Math.floor(viewport.width))),
    height: Math.max(0, Math.min(readback.height, Math.floor(viewport.height))),
  }
}

// Background color read from the four inset corners of the rect, averaged.
export function backgroundOf(readback: PixelReadback, rect: SampleRect): [number, number, number] {
  const { pixels, width } = readback
  const left = clamp(rect.x + 1, rect.x, rect.x + rect.width - 1)
  const top = clamp(rect.y + 1, rect.y, rect.y + rect.height - 1)
  const right = clamp(rect.x + rect.width - 2, rect.x, rect.x + rect.width - 1)
  const bottom = clamp(rect.y + rect.height - 2, rect.y, rect.y + rect.height - 1)
  const at = (x: number, y: number): [number, number, number] => {
    const index = (y * width + x) * 4
    return [pixels[index], pixels[index + 1], pixels[index + 2]]
  }
  const corners = [at(left, top), at(right, top), at(left, bottom), at(right, bottom)]
  return [
    Math.round(corners.reduce((sum, corner) => sum + corner[0], 0) / corners.length),
    Math.round(corners.reduce((sum, corner) => sum + corner[1], 0) / corners.length),
    Math.round(corners.reduce((sum, corner) => sum + corner[2], 0) / corners.length),
  ]
}

export function evaluateVisualValidity(input: VisualValidityInput): VisualValidity {
  const { readback } = input
  const rect = sampleRectOf(readback, input.viewport)
  const totalPixels = rect.width * rect.height
  if (totalPixels === 0) {
    return {
      valid: false,
      totalPixels: 0,
      nonBackgroundPixels: 0,
      coverageRatio: 0,
      drawnNodeCount: input.drawnNodeCount,
      drawnEdgeCount: input.drawnEdgeCount,
      actualBackend: input.actualBackend,
      requestedRenderer: input.requestedRenderer,
      sampleRect: rect,
    }
  }
  const background = backgroundOf(readback, rect)
  const { pixels } = readback
  let nonBackgroundPixels = 0
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    const row = y * readback.width
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      const index = (row + x) * 4
      const dr = pixels[index] - background[0]
      const dg = pixels[index + 1] - background[1]
      const db = pixels[index + 2] - background[2]
      if (dr * dr + dg * dg + db * db > BACKGROUND_DISTANCE_SQUARED) nonBackgroundPixels += 1
    }
  }
  return {
    valid: nonBackgroundPixels > MINIMUM_NON_BACKGROUND_PIXELS && input.drawnNodeCount > 0,
    totalPixels,
    nonBackgroundPixels,
    coverageRatio: nonBackgroundPixels / totalPixels,
    drawnNodeCount: input.drawnNodeCount,
    drawnEdgeCount: input.drawnEdgeCount,
    actualBackend: input.actualBackend,
    requestedRenderer: input.requestedRenderer,
    sampleRect: rect,
  }
}
