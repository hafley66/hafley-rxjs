export type RibbonItem<Id extends string = string> = {
  id: Id
  left: number
  width: number
  top: number
  bottom: number
  order: number
}

export type RibbonPlacement<Id extends string = string> = {
  id: Id
  left: number
  width: number
  top: number
  detail: "full" | "chip"
  state: "pinned" | "clamped-start" | "clamped-end" | "released"
}

export type RibbonInput<Id extends string = string> = {
  items: readonly RibbonItem<Id>[]
  camera: { x: number; y: number; scale: number }
  viewport: { x: number; y: number; width: number; height: number }
  inset: number
  fullWidth: number
  chipWidth: number
  gap: number
}

/**
 * Places column headers (sequence actors) in a screen-space row that survives pan and zoom.
 * A header follows its column until the column leaves the viewport sideways or shrinks below
 * `fullWidth`, at which point it condenses to a chip and clamps to the edge it left through.
 */
export function layoutStickyRibbon<Id extends string>(input: RibbonInput<Id>): RibbonPlacement<Id>[] {
  const { camera, viewport, inset, fullWidth, chipWidth, gap } = input
  const top = viewport.y + inset
  const rowStart = viewport.x + inset
  const rowEnd = viewport.x + viewport.width - inset
  let cursor = rowStart

  return [...input.items]
    .sort((left, right) => left.order - right.order || left.left - right.left || left.id.localeCompare(right.id))
    .map(item => {
      const released = (id: Id): RibbonPlacement<Id> => ({ id, left: 0, width: 0, top, detail: "chip", state: "released" })
      const bandTop = item.top * camera.scale + camera.y
      const bandBottom = item.bottom * camera.scale + camera.y
      if (bandBottom < viewport.y || bandTop > viewport.y + viewport.height) return released(item.id)

      const naturalLeft = item.left * camera.scale + camera.x
      const naturalWidth = item.width * camera.scale
      const offscreen = naturalLeft + naturalWidth <= viewport.x || naturalLeft >= viewport.x + viewport.width
      const detail = naturalWidth < fullWidth || offscreen ? "chip" : "full"
      const width = detail === "chip" ? chipWidth : naturalWidth

      const maxLeft = rowEnd - width
      const state = naturalLeft < rowStart ? "clamped-start" : naturalLeft > maxLeft ? "clamped-end" : "pinned"
      const left = Math.max(Math.min(Math.max(naturalLeft, rowStart), maxLeft), cursor)
      if (left > maxLeft) return released(item.id)

      cursor = left + width + gap
      return { id: item.id, left, width, top, detail, state }
    })
}
