# grapht-model

`@hafley66/grapht-model` is the canonical graph model: a flat record of `GraphNode` and `GraphEdge`
keyed by `GraphId`, plus validation, indexes, ancestry, and shared sticky placement. It has no
renderer and no runtime handles, so the model stays durable and framework-free.

```
pnpm add @hafley66/grapht-model
```

```ts
import { validateGraph, indexGraph, type Graph } from "@hafley66/grapht-model"

const graph: Graph = {
  a: { id: "a", type: "node" },
  b: { id: "b", type: "node", parentId: "a" },
  link: { id: "link", type: "edge", fromId: "a", toId: "b", direction: "forward" },
}

validateGraph(graph)          // []: well formed
indexGraph(graph).outgoingByEndpoint
```

Docs: https://hafley66.github.io/hafley-rxjs/grapht/model
