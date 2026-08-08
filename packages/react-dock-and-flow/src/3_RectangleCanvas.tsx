import { SignalReact } from "@hafley66/signals/react"
import { applyNodeChanges, Background, type Node, type NodeChange, ReactFlow } from "@xyflow/react"
import cytoscape from "cytoscape"
import { type FunctionComponent, useEffect, useMemo, useRef } from "react"
import type { Rectangle, RectangleContent, RectangleModel } from "./2_rectangleJournal.js"
import "./4_rectangle.css"

function GraphContent({ content }: { content: Extract<RectangleContent, { kind: "graph" }> }) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!host.current) return
    const graph = cytoscape({
      container: host.current,
      elements: [
        ...content.nodes.map(id => ({ data: { id } })),
        ...content.edges.map(([source, target], index) => ({ data: { id: `e${index}`, source, target } })),
      ],
      layout: { name: "grid" },
      style: [
        { selector: "node", style: { label: "data(id)", color: "#eee", "background-color": "#5577dd" } },
        {
          selector: "edge",
          style: {
            width: 2,
            "line-color": "#8892a8",
            "target-arrow-color": "#8892a8",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
          },
        },
      ],
    })
    return () => graph.destroy()
  }, [content])
  return <div className="rectangle-canvas__graph" data-testid="cytoscape-rectangle" ref={host} />
}

function RectangleBody({ rectangle }: { rectangle: Rectangle }) {
  return (
    <article className="rectangle-canvas__body" data-kind={rectangle.content.kind}>
      <header>{rectangle.title}</header>
      {rectangle.content.kind === "graph" ? (
        <GraphContent content={rectangle.content} />
      ) : (
        <pre>{rectangle.content.lines.join("\n")}</pre>
      )}
    </article>
  )
}

export const RectangleCanvas: FunctionComponent<{ model: RectangleModel }> = SignalReact(function RectangleCanvas({
  model,
}: {
  model: RectangleModel
}) {
  const rectangles = model.rectangles.$()
  const nodes = useMemo<Node[]>(
    () =>
      rectangles.map(rectangle => ({
        id: rectangle.id,
        position: rectangle.position,
        width: rectangle.size.width,
        height: rectangle.size.height,
        style: { width: rectangle.size.width, height: rectangle.size.height, zIndex: rectangle.z },
        data: { label: <RectangleBody rectangle={rectangle} /> },
      })),
    [rectangles],
  )
  const changed = (changes: NodeChange[]) => {
    const next = applyNodeChanges(changes, nodes)
    for (const change of changes) {
      if (change.type !== "position" || !change.position || change.dragging) continue
      const node = next.find(({ id }) => id === change.id)
      if (node) model.events.$({ type: "moved", id: node.id, position: node.position })
    }
  }
  return (
    <ReactFlow
      nodes={nodes}
      edges={[]}
      onNodesChange={changed}
      onNodeClick={(_, node) => model.events.$({ type: "raised", id: node.id })}
      fitView
    >
      <Background />
    </ReactFlow>
  )
})
