import type { Node, NodeChange, NodeProps } from "@xyflow/react"
import type { ComponentType } from "react"

export type DockFlowNodeData = { title: string; panelId: string }
export type DockFlowNode = Node<DockFlowNodeData, "dockFlowPanel">

export type DockFlowEvent =
  | { type: "node-count-selected"; count: number }
  | { type: "nodes-changed"; changes: NodeChange<DockFlowNode>[] }
  | { type: "panel-value-changed"; panelId: string; value: string }
  | { type: "layout-created"; dockPanels: number }

export type DockFlowState = {
  nodes: DockFlowNode[]
  values: Record<string, string>
  requestedNodes: number
  dockPanels: number
  eventCount: number
  lastEvent: DockFlowEvent["type"] | "initial"
}

export type DockFlowNodeComponent = ComponentType<NodeProps<DockFlowNode>>
