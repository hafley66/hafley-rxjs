import { SignalReact } from "@hafley66/signals/react"
import {
  Background,
  Controls,
  MiniMap,
  type NodeChange,
  type NodeProps,
  type OnNodesChange,
  ReactFlow,
} from "@xyflow/react"
import { DockviewReact, type DockviewReadyEvent, type IDockviewPanelProps, themeDark } from "dockview"
import { createElement, type FunctionComponent, useCallback, useEffect, useId, useMemo, useRef } from "react"
import type { DockFlowNode, DockFlowNodeComponent } from "./0_types.js"
import type { DockAndFlowModel } from "./1_model.js"
import "./3_style.css"

export type DockAndFlowProps = {
  model: DockAndFlowModel
  node: DockFlowNodeComponent
  details?: FunctionComponent<IDockviewPanelProps>
  className?: string
}

type DockAndFlowContextValue = {
  model: DockAndFlowModel
  node: DockFlowNodeComponent
  details: FunctionComponent<IDockviewPanelProps>
}

type WorkspaceParams = { workspaceId: string }

const workspaces = new Map<string, DockAndFlowContextValue>()

function workspace(workspaceId: string): DockAndFlowContextValue {
  const value = workspaces.get(workspaceId)
  if (!value) throw new Error(`DockAndFlow workspace ${workspaceId} is not registered`)
  return value
}

const CanvasPanel = SignalReact(function CanvasPanel({ params }: IDockviewPanelProps<WorkspaceParams>) {
  const { model, node: NodeView } = workspace(params.workspaceId)
  const nodes = model.state.nodes.$()
  const renderNodes = useMemo(
    () =>
      nodes.map(node => ({
        ...node,
        type: "default",
        data: {
          ...node.data,
          label: createElement(NodeView, { id: node.id, data: node.data } as NodeProps<DockFlowNode>),
        },
      })),
    [NodeView, nodes],
  )
  const changed = useCallback(
    (changes: NodeChange<DockFlowNode>[]) => {
      const controlled = changes.filter(change => change.type !== "dimensions")
      if (controlled.length) model.events.$({ type: "nodes-changed", changes: controlled })
    },
    [model.events.$],
  )
  return (
    <ReactFlow
      nodes={renderNodes}
      edges={[]}
      onNodesChange={changed as OnNodesChange}
      fitView
      onlyRenderVisibleElements
    >
      <Background />
      <MiniMap pannable zoomable />
      <Controls />
    </ReactFlow>
  )
})

function DetailsPanel({ params }: IDockviewPanelProps<WorkspaceParams>) {
  return createElement(workspace(params.workspaceId).details)
}

const components = { canvas: CanvasPanel, details: DetailsPanel }

const DefaultDetails = () => <div className="react-dock-and-flow__details">Select a spatial panel.</div>

export function DockAndFlow({ model, node, details, className = "react-dock-and-flow" }: DockAndFlowProps) {
  const initialized = useRef(false)
  const workspaceId = useId()
  const NodeDetails = details ?? DefaultDetails
  workspaces.set(workspaceId, { model, node, details: NodeDetails })
  useEffect(() => () => void workspaces.delete(workspaceId), [workspaceId])
  const ready = useCallback(
    (event: DockviewReadyEvent) => {
      if (initialized.current) return
      initialized.current = true
      const canvas = event.api.addPanel({
        id: "canvas",
        component: "canvas",
        title: "Canvas",
        params: { workspaceId },
      })
      event.api.addPanel({
        id: "details",
        component: "details",
        title: "Details",
        params: { workspaceId },
        position: { referencePanel: canvas, direction: "right" },
      })
      model.events.$({ type: "layout-created", dockPanels: event.api.panels.length })
    },
    [model, workspaceId],
  )
  return <DockviewReact className={className} theme={themeDark} components={components} onReady={ready} />
}
