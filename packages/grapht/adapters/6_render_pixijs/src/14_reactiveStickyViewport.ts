import { layoutStickyStack, type StickyStackPlacement } from "@hafley66/grapht-model"
import { renderer, type Renderer } from "@hafley66/scene"
import type { Container } from "pixi.js"

export type ViewportSnapshot = {
  x: number
  y: number
  scale: number
}

export type ReactiveStickyItem<Id extends string = string> = {
  id: Id
  worldTop: number
  boundaryWorldBottom: number
  localTop: number
  height: number
  order: number
}

export type ReactiveStickyModel<Id extends string = string> = {
  actorWorldTop: number
  actorScreenTop: number
  inset: number
  gap: number
  items: readonly ReactiveStickyItem<Id>[]
}

export type ReactiveStickyPlacement<Id extends string = string> = StickyStackPlacement<Id> & {
  localY: number
}

export type ReactiveStickyFrame<Id extends string = string> = {
  viewport: ViewportSnapshot
  actorLayer: { x: number; y: number; scale: number }
  groupLayer: { x: number; y: number; scale: number }
  placements: readonly ReactiveStickyPlacement<Id>[]
}

export function projectReactiveStickyFrame<Id extends string>(
  model: ReactiveStickyModel<Id>,
  viewport: ViewportSnapshot,
): ReactiveStickyFrame<Id> {
  const items = [...model.items].sort((left, right) => left.order - right.order)
  const placements = layoutStickyStack({
    inset: model.actorScreenTop + model.inset,
    gap: model.gap,
    items: items.map(item => ({
      id: item.id,
      naturalTop: viewport.y + item.worldTop * viewport.scale,
      boundaryBottom: viewport.y + item.boundaryWorldBottom * viewport.scale,
      height: item.height * viewport.scale,
      order: item.order,
    })),
  }).map((placement, index): ReactiveStickyPlacement<Id> => ({
    ...placement,
    localY: placement.top / viewport.scale - items[index].localTop,
  }))

  return {
    viewport,
    actorLayer: {
      x: viewport.x,
      y: model.actorScreenTop - model.actorWorldTop * viewport.scale,
      scale: viewport.scale,
    },
    groupLayer: { x: viewport.x, y: 0, scale: viewport.scale },
    placements,
  }
}

export type ReactiveStickyRendererReceipt = {
  frames: number
  writes: number
}

export type ReactiveStickyRenderer<Id extends string> = Renderer<ReactiveStickyFrame<Id>> & {
  receipt(): ReactiveStickyRendererReceipt
}

export function pixiReactiveStickyViewport<Id extends string>(config: {
  actorLayer: Container
  groupLayer: Container
  nodes: ReadonlyMap<Id, Container>
}): ReactiveStickyRenderer<Id> {
  let frames = 0
  let writes = 0
  const operator = renderer<undefined, ReactiveStickyFrame<Id>>({
    subscribe: () => undefined,
    next: (_state, frame) => {
      frames += 1
      config.actorLayer.position.set(frame.actorLayer.x, frame.actorLayer.y)
      config.actorLayer.scale.set(frame.actorLayer.scale)
      config.groupLayer.position.set(frame.groupLayer.x, frame.groupLayer.y)
      config.groupLayer.scale.set(frame.groupLayer.scale)
      writes += 6

      for (const placement of frame.placements) {
        const node = config.nodes.get(placement.id)
        if (!node) continue
        if (node.visible !== placement.visible) {
          node.visible = placement.visible
          writes += 1
        }
        if (node.y !== placement.localY) {
          node.y = placement.localY
          writes += 1
        }
      }
    },
    unsubscribe: () => undefined,
  }) as ReactiveStickyRenderer<Id>
  operator.receipt = () => ({ frames, writes })
  return operator
}
