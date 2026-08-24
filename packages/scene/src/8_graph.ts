import type { Frame, Id, Renderer } from "./0_types.js"

export type GraphViewport = {
  x: number
  y: number
  zoom: number
}

export type GraphView = {
  viewport: GraphViewport
  visible: ReadonlySet<Id>
  selected: ReadonlySet<Id>
  hovered?: Id
}

export type GraphNodeShape = "circle" | "ellipse" | "rectangle" | "round-rectangle" | "diamond"
export type GraphLineStyle = "solid" | "dashed" | "dotted"

export type GraphLabelStyle = {
  color: string
  fontFamily: string
  fontSize: number
  fontWeight: number
}

export type GraphNodeStyle = {
  shape: GraphNodeShape
  fill: string
  stroke: string
  strokeWidth: number
  opacity: number
  label?: GraphLabelStyle
}

export type GraphEdgeStyle = {
  color: string
  width: number
  line: GraphLineStyle
  opacity: number
  directed: boolean
  label?: GraphLabelStyle
}

export type GraphStyle = {
  node: GraphNodeStyle
  edge: GraphEdgeStyle
  nodes?: ReadonlyMap<Id, Partial<GraphNodeStyle>>
  edges?: ReadonlyMap<Id, Partial<GraphEdgeStyle>>
}

export type GraphModifiers = {
  shift: boolean
  alt: boolean
  control: boolean
  meta: boolean
}

export type GraphInteraction =
  | { type: "node-hover"; id?: Id }
  | { type: "edge-hover"; id?: Id }
  | { type: "node-select"; id: Id; additive: boolean }
  | { type: "node-move"; id: Id; x: number; y: number }
  | { type: "viewport-change"; viewport: GraphViewport }
  | { type: "background-pointer"; x: number; y: number; modifiers: GraphModifiers }

export type GraphFrame = Frame & {
  view: GraphView
  style: GraphStyle
}

export type GraphRenderer = Renderer<GraphFrame>

export const EMPTY_GRAPH_VIEW: GraphView = {
  viewport: { x: 0, y: 0, zoom: 1 },
  visible: new Set(),
  selected: new Set(),
}
