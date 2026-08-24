export type StickyStackItem<Id extends string = string> = {
  id: Id
  naturalTop: number
  boundaryBottom: number
  height: number
  order: number
}

export type StickyStackPlacement<Id extends string = string> = {
  id: Id
  top: number
  slot: number
  visible: boolean
  state: "natural" | "stuck" | "released"
}

export type StickyStackInput<Id extends string = string> = {
  items: StickyStackItem<Id>[]
  inset: number
  gap: number
}

export function layoutStickyStack<Id extends string>(input: StickyStackInput<Id>): StickyStackPlacement<Id>[] {
  let cursor = input.inset
  return [...input.items]
    .sort((left, right) => left.order - right.order || left.naturalTop - right.naturalTop)
    .map(item => {
      const slot = cursor
      const visible = item.boundaryBottom > slot
      const stuck = visible && item.naturalTop <= slot
      const placement: StickyStackPlacement<Id> = {
        id: item.id,
        top: stuck ? slot : item.naturalTop,
        slot,
        visible,
        state: visible ? (stuck ? "stuck" : "natural") : "released",
      }
      if (stuck) cursor = placement.top + item.height + input.gap
      return placement
    })
}
