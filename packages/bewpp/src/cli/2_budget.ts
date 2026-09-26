export type ClipResult = { text: string; clipped: boolean; withheld: number }

export interface Region {
  key: string
  weight: number
  fullBytes: number
  /** Must return a valid result for any maxBytes, including 0 (a bare handle). */
  render(maxBytes: number): ClipResult
}

export type Allocated = { key: string; result: ClipResult }

/** Splits byteBudget-header-footer across regions by weight; if that leaves nothing, every region renders at 0 bytes. */
export function allocateBudget(byteBudget: number, headerBytes: number, footerBytes: number, regions: Region[]): Allocated[] {
  const overhead = headerBytes + footerBytes
  if (overhead >= byteBudget) return regions.map(region => ({ key: region.key, result: region.render(0) }))
  const remaining = byteBudget - overhead
  const totalWeight = regions.reduce((sum, region) => sum + region.weight, 0) || 1
  return regions.map(region => {
    const share = Math.floor((remaining * region.weight) / totalWeight)
    return { key: region.key, result: region.render(Math.min(share, region.fullBytes)) }
  })
}
