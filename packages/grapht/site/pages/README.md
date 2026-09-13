# grapht

`@hafley66/grapht` is a graph diagram toolkit. It ingests d2 and mermaid sources into one canonical,
framework-free `Graph` model, renders that model through swappable renderer adapters, and journals
git history offline so the graph can be reconstructed at any point in time. The canonical model
lives in `@hafley66/grapht-model`; this package owns the frame (geometry, camera, presentation), the
renderer contract, and the history journal.

```
pnpm add @hafley66/grapht @hafley66/grapht-model
```

```ts
import type { Graph } from "@hafley66/grapht-model"
import { fitGraphCamera } from "@hafley66/grapht"

const graph: Graph = {
  a: { id: "a", type: "node" },
  b: { id: "b", type: "node" },
  link: { id: "link", type: "edge", fromId: "a", toId: "b", direction: "forward" },
}
```

Fit a camera over any geometry with `fitGraphCamera(geometry, viewport, padding)`, then hand each
`GraphFrame` to a `GraphFrameResource` adapter for the target renderer.

Docs: https://hafley66.github.io/hafley-rxjs/grapht/
