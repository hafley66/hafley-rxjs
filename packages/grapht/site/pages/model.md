# The canonical model

- [What a Graph is](#what-a-graph-is)
- [A real graph literal](#a-real-graph-literal)
- [validateGraph](#dévalidategraph)
- [indexGraph](#indexgraph)
- [Ancestors, descendants, depth](#ancestors-descendants-depth)

Source: `packages/grapht-model/src/6_graph.ts`.

## What a Graph is

`Graph` is a flat record of items keyed by `GraphId`, where every key is also the item's own `id`.
There is no nesting by value: parent and child are linked through `parentId`, and edge endpoints
through `fromId` and `toId`. Declared at `packages/grapht-model/src/6_graph.ts:40`.

| type | declared at | shape |
| --- | --- | --- |
| `GraphId` | `packages/grapht-model/src/6_graph.ts:1` | `string` |
| `GraphNode` | `packages/grapht-model/src/6_graph.ts:26` | `{ type: "node", id, parentId?, layout?, data? }` |
| `GraphEdge` | `packages/grapht-model/src/6_graph.ts:31` | `{ type: "edge", id, fromId, toId, direction }` |
| `Graph` | `packages/grapht-model/src/6_graph.ts:40` | `Readonly<Record<GraphId, GraphItem>>` |

An edge's `direction` is `"none" | "forward" | "both"`. A node's `layout` is one of `managed`,
`sealed`, or `excluded` per `LayoutParticipation` at `packages/grapht-model/src/6_graph.ts:15`.
`managed` hands geometry to a layout engine, `sealed` carries retained bounds plus a
`geometryRevisionId`, and `excluded` sits outside layout entirely.

## A real graph literal

```ts
import type { Graph } from "@hafley66/grapht-model"

const graph: Graph = {
  root: { id: "root", type: "node" },
  left: { id: "left", type: "node", parentId: "root" },
  right: { id: "right", type: "node", parentId: "root" },
  link: {
    id: "link", type: "edge",
    fromId: "left", toId: "right", direction: "forward",
  },
}
```

## validateGraph

`validateGraph(graph)` returns a list of `GraphDiagnostic`, each with a `code` and a `message`
(`packages/grapht-model/src/6_graph.ts:64`). An empty list means the graph is well formed.

| code | rejected when | declared at |
| --- | --- | --- |
| `GRAPH_KEY_ID_MISMATCH` | a record key does not equal the item's `id` | `packages/grapht-model/src/6_graph.ts:70` |
| `GRAPH_MISSING_PARENT` | `parentId` names an id that is not in the graph | `packages/grapht-model/src/6_graph.ts:76` |
| `GRAPH_MISSING_ENDPOINT` | an edge's `fromId` or `toId` is not in the graph | `packages/grapht-model/src/6_graph.ts:82` |
| `GRAPH_PARENT_CYCLE` | `parentId` links form a cycle | `packages/grapht-model/src/6_graph.ts:113` |

```ts
import { validateGraph } from "@hafley66/grapht-model"

validateGraph({
  a: { id: "a", type: "node" },
  b: { id: "b", type: "node", parentId: "missing" },
  e: { id: "e", type: "edge", fromId: "a", toId: "nowhere", direction: "forward" },
})
// [{ code: "GRAPH_MISSING_PARENT", message: "item b references missing parent missing" },
//  { code: "GRAPH_MISSING_ENDPOINT", message: "edge e references missing endpoint nowhere" }]
```

## indexGraph

`indexGraph(graph)` derives four read-only maps in one pass over the sorted ids
(`packages/grapht-model/src/6_graph.ts:123`), returned by `GraphIndexes`
(`packages/grapht-model/src/6_graph.ts:47`).

| map | content |
| --- | --- |
| `childrenByParent` | direct children of each node |
| `incomingByEndpoint` | edges arriving at each node |
| `outgoingByEndpoint` | edges leaving each node |
| `incidentByEndpoint` | every edge touching each node, including self edges |

A `direction: "none"` edge is incident but neither incoming nor outgoing, so a renderer that draws
only directed edges still sees it. A self edge is incident once.

## Ancestors, descendants, depth

| function | returns | declared at |
| --- | --- | --- |
| `ancestorsOf(graph, id)` | parent chain, closest first, cycle-safe | `packages/grapht-model/src/6_graph.ts:167` |
| `descendantsOf(graph, id)` | every descendant, sorted | `packages/grapht-model/src/6_graph.ts:179` |
| `depthOf(graph, id)` | number of ancestors | `packages/grapht-model/src/6_graph.ts:192` |

`ancestorsOf` walks `parentId` up to the root and stops at a revisit, so it cannot loop on a malformed
cycle. `descendantsOf` reuses `indexGraph` and sorts its result.
