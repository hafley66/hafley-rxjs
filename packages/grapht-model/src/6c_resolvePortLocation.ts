import type { GraphId, GraphPoint, GraphRect } from "./6_graph.js"
import type { PortLocation, PortOrientation, PortPathOffset } from "./6b_portLocation.js"

export type ResolvedPortLocation = {
  position: GraphPoint
  tangent: GraphPoint
  normal: GraphPoint
  angle: number
}

export type PortLocationContext = {
  ownerBounds: GraphRect
  pathsById: Readonly<Record<GraphId, Float32Array>>
}

function pathLength(path: Float32Array): number {
  let length = 0
  for (let index = 2; index < path.length; index += 2) length += Math.hypot(path[index] - path[index - 2], path[index + 1] - path[index - 1])
  return length
}

function distanceOf(offset: PortPathOffset, length: number): number {
  return Math.min(length, Math.max(0, offset.unit === "ratio" ? offset.value * length : offset.value))
}

function sample(path: Float32Array, offset: PortPathOffset): Omit<ResolvedPortLocation, "angle"> {
  if (path.length < 4 || path.length % 2 !== 0) throw new Error("port path must contain at least two x/y coordinate pairs")
  let remaining = distanceOf(offset, pathLength(path))
  for (let index = 2; index < path.length; index += 2) {
    const x = path[index] - path[index - 2]
    const y = path[index + 1] - path[index - 1]
    const length = Math.hypot(x, y)
    if (length === 0) continue
    if (remaining <= length || index === path.length - 2) {
      const ratio = Math.min(1, remaining / length)
      const tangent = { x: x / length, y: y / length }
      return {
        position: { x: path[index - 2] + x * ratio, y: path[index - 1] + y * ratio },
        tangent,
        normal: { x: -tangent.y, y: tangent.x },
      }
    }
    remaining -= length
  }
  throw new Error("port path has no non-zero segment")
}

function sidePath(bounds: GraphRect, side: "top" | "right" | "bottom" | "left"): Float32Array {
  switch (side) {
    case "top": return new Float32Array([bounds.x, bounds.y, bounds.x + bounds.width, bounds.y])
    case "right": return new Float32Array([bounds.x + bounds.width, bounds.y, bounds.x + bounds.width, bounds.y + bounds.height])
    case "bottom": return new Float32Array([bounds.x + bounds.width, bounds.y + bounds.height, bounds.x, bounds.y + bounds.height])
    case "left": return new Float32Array([bounds.x, bounds.y + bounds.height, bounds.x, bounds.y])
  }
}

function angleOf(orientation: PortOrientation | undefined, tangent: GraphPoint): number {
  if (orientation === undefined || orientation.mode === "none") return 0
  if (orientation.mode === "fixed") return orientation.angle
  const tangentAngle = Math.atan2(tangent.y, tangent.x)
  return tangentAngle + (orientation.mode === "reverse-tangent" ? Math.PI : 0) + (orientation.angleOffset ?? 0)
}

export function resolvePortLocation(location: PortLocation, context: PortLocationContext): ResolvedPortLocation {
  if (location.kind === "absolute") return { position: location.point, tangent: { x: 1, y: 0 }, normal: { x: 0, y: 1 }, angle: 0 }
  if (location.kind === "relative-box") {
    return {
      position: { x: context.ownerBounds.x + context.ownerBounds.width * location.x, y: context.ownerBounds.y + context.ownerBounds.height * location.y },
      tangent: { x: 1, y: 0 },
      normal: { x: 0, y: 1 },
      angle: 0,
    }
  }
  const path = location.kind === "path"
    ? context.pathsById[location.pathId]
    : location.kind === "side"
      ? sidePath(context.ownerBounds, location.side)
      : new Float32Array([
          context.ownerBounds.x, context.ownerBounds.y,
          context.ownerBounds.x + context.ownerBounds.width, context.ownerBounds.y,
          context.ownerBounds.x + context.ownerBounds.width, context.ownerBounds.y + context.ownerBounds.height,
          context.ownerBounds.x, context.ownerBounds.y + context.ownerBounds.height,
          context.ownerBounds.x, context.ownerBounds.y,
        ])
  if (path === undefined) throw new Error(`missing port path ${location.kind === "path" ? location.pathId : ""}`.trim())
  const resolved = sample(path, location.offset)
  const lateralOffset = location.lateralOffset ?? 0
  return {
    ...resolved,
    position: { x: resolved.position.x + resolved.normal.x * lateralOffset, y: resolved.position.y + resolved.normal.y * lateralOffset },
    angle: angleOf(location.orientation, resolved.tangent),
  }
}
