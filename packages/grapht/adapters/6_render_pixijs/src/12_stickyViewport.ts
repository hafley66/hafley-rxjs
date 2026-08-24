import { layoutStickyStack, type StickyStackPlacement } from "@hafley66/grapht-model"
import type { Container } from "pixi.js"
import type { Viewport } from "pixi-viewport"

export type PixiPinnedViewportRow = {
  layout(): void
  destroy(): void
}

export type PixiStickyViewportItem<Id extends string = string> = {
  id: Id
  node: Container
  worldTop: number
  boundaryWorldBottom: number
  localTop: number
  height: number
  order: number
}

export type PixiStickyViewportStack<Id extends string = string> = {
  layout(): StickyStackPlacement<Id>[]
  receipt(): StickyStackPlacement<Id>[]
  destroy(): void
}

export function createPixiPinnedViewportRow(config: {
  viewport: Viewport
  layer: Container
  worldTop: number
  screenTop: number
}): PixiPinnedViewportRow {
  const layout = () => {
    const scale = config.viewport.scale.x
    config.layer.position.set(config.viewport.x, config.screenTop - config.worldTop * scale)
    config.layer.scale.set(scale)
  }
  config.viewport.on("moved", layout)
  config.viewport.on("zoomed", layout)
  layout()
  return {
    layout,
    destroy() {
      config.viewport.off("moved", layout)
      config.viewport.off("zoomed", layout)
    },
  }
}

export function createPixiStickyViewportStack<Id extends string>(config: {
  viewport: Viewport
  layer: Container
  items: PixiStickyViewportItem<Id>[]
  inset: () => number
  gap: number
}): PixiStickyViewportStack<Id> {
  let placements: StickyStackPlacement<Id>[] = []
  const layout = () => {
    const scale = config.viewport.scale.x
    config.layer.position.set(config.viewport.x, 0)
    config.layer.scale.set(scale)
    placements = layoutStickyStack({
      inset: config.inset(),
      gap: config.gap,
      items: config.items.map(item => ({
        id: item.id,
        naturalTop: config.viewport.y + item.worldTop * scale,
        boundaryBottom: config.viewport.y + item.boundaryWorldBottom * scale,
        height: item.height * scale,
        order: item.order,
      })),
    })
    const byId = new Map(placements.map(placement => [placement.id, placement]))
    for (const item of config.items) {
      const placement = byId.get(item.id)!
      item.node.visible = placement.visible
      item.node.y = placement.top / scale - item.localTop
    }
    return placements.map(placement => ({ ...placement }))
  }
  config.viewport.on("moved", layout)
  config.viewport.on("zoomed", layout)
  layout()
  return {
    layout,
    receipt() {
      return placements.map(placement => ({ ...placement }))
    },
    destroy() {
      config.viewport.off("moved", layout)
      config.viewport.off("zoomed", layout)
    },
  }
}
