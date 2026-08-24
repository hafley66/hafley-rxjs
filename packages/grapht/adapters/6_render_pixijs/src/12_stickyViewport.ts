import { layoutStickyStack, type StickyStackPlacement } from "@hafley66/grapht-model"
import { UPDATE_PRIORITY, type Container, type Ticker } from "pixi.js"
import type { Viewport } from "pixi-viewport"

export type PixiViewportLayoutSchedulerReceipt = {
  requests: number
  flushes: number
  coalescedRequests: number
  callbacks: number
}

export type PixiViewportLayoutScheduler = {
  add(layout: () => void): () => void
  request(): void
  flush(): void
  receipt(): PixiViewportLayoutSchedulerReceipt
  destroy(): void
}

export function createPixiViewportLayoutScheduler(config: {
  viewport: Viewport
  ticker: Ticker
}): PixiViewportLayoutScheduler {
  const layouts = new Set<() => void>()
  let pending = false
  let requests = 0
  let flushes = 0
  let callbacks = 0
  const request = () => {
    requests += 1
    pending = true
  }
  const flush = () => {
    if (!pending) return
    pending = false
    flushes += 1
    for (const layout of layouts) {
      callbacks += 1
      layout()
    }
  }
  config.viewport.on("moved", request)
  config.viewport.on("zoomed", request)
  config.ticker.add(flush, undefined, UPDATE_PRIORITY.LOW + 1)
  return {
    add(layout) {
      layouts.add(layout)
      layout()
      return () => layouts.delete(layout)
    },
    request,
    flush,
    receipt() {
      return {
        requests,
        flushes,
        coalescedRequests: requests - flushes,
        callbacks,
      }
    },
    destroy() {
      config.viewport.off("moved", request)
      config.viewport.off("zoomed", request)
      config.ticker.remove(flush)
      layouts.clear()
    },
  }
}

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
  scheduler?: PixiViewportLayoutScheduler
}): PixiPinnedViewportRow {
  const layout = () => {
    const scale = config.viewport.scale.x
    config.layer.position.set(config.viewport.x, config.screenTop - config.worldTop * scale)
    config.layer.scale.set(scale)
  }
  const removeScheduledLayout = config.scheduler?.add(layout)
  if (!config.scheduler) {
    config.viewport.on("moved", layout)
    config.viewport.on("zoomed", layout)
    layout()
  }
  return {
    layout,
    destroy() {
      removeScheduledLayout?.()
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
  scheduler?: PixiViewportLayoutScheduler
}): PixiStickyViewportStack<Id> {
  let placements: StickyStackPlacement<Id>[] = []
  const items = [...config.items].sort((left, right) => left.order - right.order)
  const layout = () => {
    const scale = config.viewport.scale.x
    config.layer.position.set(config.viewport.x, 0)
    config.layer.scale.set(scale)
    placements = layoutStickyStack({
      inset: config.inset(),
      gap: config.gap,
      items: items.map(item => ({
        id: item.id,
        naturalTop: config.viewport.y + item.worldTop * scale,
        boundaryBottom: config.viewport.y + item.boundaryWorldBottom * scale,
        height: item.height * scale,
        order: item.order,
      })),
    })
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index]
      const placement = placements[index]
      if (item.node.visible !== placement.visible) item.node.visible = placement.visible
      const y = placement.top / scale - item.localTop
      if (item.node.y !== y) item.node.y = y
    }
    return placements.map(placement => ({ ...placement }))
  }
  const removeScheduledLayout = config.scheduler?.add(layout)
  if (!config.scheduler) {
    config.viewport.on("moved", layout)
    config.viewport.on("zoomed", layout)
    layout()
  }
  return {
    layout,
    receipt() {
      return placements.map(placement => ({ ...placement }))
    },
    destroy() {
      removeScheduledLayout?.()
      config.viewport.off("moved", layout)
      config.viewport.off("zoomed", layout)
    },
  }
}
