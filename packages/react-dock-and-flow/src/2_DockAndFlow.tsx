import { SignalReact } from "@hafley66/signals/react"
import { Background, Controls, MiniMap, type NodeChange, ReactFlow } from "@xyflow/react"
import { DockviewReact, type DockviewReadyEvent, type IDockviewPanelProps, themeDark } from "dockview"
import { createElement, type FunctionComponent, useCallback, useRef } from "react"
import type { DockFlowNode, DockFlowNodeComponent } from "./0_types.js"
import type { DockAndFlowModel } from "./1_model.js"
import "./3_style.css"

export type DockAndFlowProps = {
  model: DockAndFlowModel
  node: DockFlowNodeComponent
  details?: FunctionComponent<IDockviewPanelProps>
  className?: string
}

type CanvasParams = {
  model: DockAndFlowModel
  node: DockFlowNodeComponent
}

type DetailsParams = {
  details: FunctionComponent<IDockviewPanelProps>
}

const CanvasPanel = SignalReact(function CanvasPanel({ params }: IDockviewPanelProps<CanvasParams>) {
  const nodes = params.model.state.nodes.$()
  const changed = useCallback(
    (changes: NodeChange<DockFlowNode>[]) => params.model.events.$({ type: "nodes-changed", changes }),
    [params.model.events.$],
  )
  return (
    <ReactFlow
      nodes={nodes}
      edges={[]}
      nodeTypes={{ dockFlowPanel: params.node }}
      onNodesChange={changed}
      onlyRenderVisibleElements
    >
      <Background />
      <MiniMap pannable zoomable />
      <Controls />
    </ReactFlow>
  )
})

function DetailsPanel({ params }: IDockviewPanelProps<DetailsParams>) {
  return createElement(params.details)
}

const components = { canvas: CanvasPanel, details: DetailsPanel }

const DefaultDetails = () => <div className="react-dock-and-flow__details">Select a spatial panel.</div>

export function DockAndFlow({ model, node, details, className = "react-dock-and-flow" }: DockAndFlowProps) {
  const initialized = useRef(false)
  const NodeDetails = details ?? DefaultDetails
  const ready = useCallback(
    (event: DockviewReadyEvent) => {
      if (initialized.current) return
      initialized.current = true
      const canvas = event.api.addPanel({
        id: "canvas",
        component: "canvas",
        title: "Canvas",
        params: { model, node },
      })
      event.api.addPanel({
        id: "details",
        component: "details",
        title: "Details",
        params: { details: NodeDetails },
        position: { referencePanel: canvas, direction: "right" },
      })
      model.events.$({ type: "layout-created", dockPanels: event.api.panels.length })
    },
    [model, node, NodeDetails],
  )
  return <DockviewReact className={className} theme={themeDark} components={components} onReady={ready} />
}
