# grapht-model

`@hafley66/grapht-model` is the canonical graph model: a flat record of `GraphNode` and `GraphEdge`
keyed by `GraphId`, plus validation, indexes, ancestry, and shared sticky placement. It has no
renderer and no runtime handles, so the model stays durable and framework-free.

It also owns the source-language model shared by the parsers: `SourceSpan` for every language,
and the markdown lane (`mdDocument`, `MdBlock`, `blockAt`) that reads a markdown file into
sections and blocks with absolute offsets.

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
