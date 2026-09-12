import type { GraphId, GraphPoint } from "./6_graph.js"

export type PortPathOffset =
  | { unit: "ratio"; value: number }
  | { unit: "length"; value: number }

export type PortOrientation =
  | { mode: "none" }
  | { mode: "tangent"; angleOffset?: number }
  | { mode: "reverse-tangent"; angleOffset?: number }
  | { mode: "fixed"; angle: number }

export type PortLocation =
  | {
      kind: "absolute"
      point: GraphPoint
    }
  | {
      kind: "relative-box"
      x: number
      y: number
    }
  | {
      kind: "side"
      side: "top" | "right" | "bottom" | "left"
      offset: PortPathOffset
      lateralOffset?: number
      orientation?: PortOrientation
    }
  | {
      kind: "boundary"
      offset: PortPathOffset
      lateralOffset?: number
      orientation?: PortOrientation
    }
  | {
      kind: "path"
      pathId: GraphId
      offset: PortPathOffset
      lateralOffset?: number
      orientation?: PortOrientation
    }

export type GraphPort = {
  id: GraphId
  ownerId: GraphId
  location: PortLocation
}
