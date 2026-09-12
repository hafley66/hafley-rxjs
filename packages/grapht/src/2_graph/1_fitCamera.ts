import type { GraphCamera, GraphGeometry } from "./0_frame.js"
import type { Rect } from "../1_sequence/3_geometry.js"

type Extent = { left: number; top: number; right: number; bottom: number }

function finite(value: number): boolean {
  return Number.isFinite(value)
}

function includePoint(extent: Extent | undefined, x: number, y: number): Extent | undefined {
  if (!finite(x) || !finite(y)) return extent
  if (extent === undefined) return { left: x, top: y, right: x, bottom: y }
  return {
    left: Math.min(extent.left, x),
    top: Math.min(extent.top, y),
    right: Math.max(extent.right, x),
    bottom: Math.max(extent.bottom, y),
  }
}

function includeRect(extent: Extent | undefined, rect: Rect): Extent | undefined {
  if (!finite(rect.x) || !finite(rect.y) || !finite(rect.width) || !finite(rect.height)) return extent
  const left = Math.min(rect.x, rect.x + rect.width)
  const top = Math.min(rect.y, rect.y + rect.height)
  const right = Math.max(rect.x, rect.x + rect.width)
  const bottom = Math.max(rect.y, rect.y + rect.height)
  return includePoint(includePoint(extent, left, top), right, bottom)
}

function extentOf(geometry: GraphGeometry): Extent | undefined {
  let extent: Extent | undefined
  for (const bounds of Object.values(geometry.boundsById)) extent = includeRect(extent, bounds)
  for (const bounds of Object.values(geometry.headerBoundsById)) extent = includeRect(extent, bounds)
  for (const route of Object.values(geometry.routesById)) {
    for (let index = 0; index + 1 < route.length; index += 2) extent = includePoint(extent, route[index], route[index + 1])
  }
  return extent
}

/** Fits all declared graph geometry into a viewport using a screen-space padding. */
export function fitGraphCamera(geometry: GraphGeometry, viewport: Rect, padding: number): GraphCamera {
  const viewportX = finite(viewport.x) ? viewport.x : 0
  const viewportY = finite(viewport.y) ? viewport.y : 0
  const viewportWidth = finite(viewport.width) ? Math.max(0, viewport.width) : 0
  const viewportHeight = finite(viewport.height) ? Math.max(0, viewport.height) : 0
  const safePadding = finite(padding) ? Math.max(0, padding) : 0
  const extent = extentOf(geometry)
  if (extent === undefined) {
    return {
      x: viewportX + viewportWidth / 2,
      y: viewportY + viewportHeight / 2,
      scale: 1,
      viewport,
    }
  }

  const contentWidth = extent.right - extent.left
  const contentHeight = extent.bottom - extent.top
  const availableWidth = Math.max(0, viewportWidth - safePadding * 2)
  const availableHeight = Math.max(0, viewportHeight - safePadding * 2)
  const scaleX = contentWidth > 0 ? availableWidth / contentWidth : Number.POSITIVE_INFINITY
  const scaleY = contentHeight > 0 ? availableHeight / contentHeight : Number.POSITIVE_INFINITY
  const requestedScale = Math.min(scaleX, scaleY)
  const scale = Number.isFinite(requestedScale) && requestedScale > 0 ? requestedScale : requestedScale === 0 ? Number.MIN_VALUE : 1
  const contentCenterX = (extent.left + extent.right) / 2
  const contentCenterY = (extent.top + extent.bottom) / 2

  return {
    x: viewportX + viewportWidth / 2 - contentCenterX * scale,
    y: viewportY + viewportHeight / 2 - contentCenterY * scale,
    scale,
    viewport,
  }
}
