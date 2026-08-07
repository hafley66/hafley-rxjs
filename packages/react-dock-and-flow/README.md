# @hafley66/react-dock-and-flow

Dockview and React Flow composition driven by RxJS and `@hafley66/signals`.

## Install

```sh
npm install @hafley66/react-dock-and-flow dockview @xyflow/react react react-dom rxjs
```

Import the package stylesheet once:

```ts
import "@hafley66/react-dock-and-flow/style.css"
```

## Model

```ts
import { createDockAndFlowModel } from "@hafley66/react-dock-and-flow"

const model = createDockAndFlowModel(100)

model.events.$({ type: "node-count-selected", count: 500 })
model.events.$({
  type: "panel-value-changed",
  panelId: "panel-0",
  value: "retained",
})

console.log(model.state.$())
model.dispose()
```

`events.$` accepts events. `state.$()` reads the current snapshot. Nested signal access such as `state.nodes.$()` is available through the Hafley signal proxy.

## React

```tsx
import type { NodeProps } from "@xyflow/react"
import {
  createDockAndFlowModel,
  DockAndFlow,
  type DockFlowNode,
} from "@hafley66/react-dock-and-flow"

const model = createDockAndFlowModel()

function PanelNode({ data }: NodeProps<DockFlowNode>) {
  return <section>{data.title}</section>
}

export function Workspace() {
  return <DockAndFlow model={model} node={PanelNode} />
}
```

The root containing `DockAndFlow` must have a measurable width and height.

## Events

```ts
type DockFlowEvent =
  | { type: "node-count-selected"; count: number }
  | { type: "nodes-changed"; changes: NodeChange<DockFlowNode>[] }
  | { type: "panel-value-changed"; panelId: string; value: string }
  | { type: "layout-created"; dockPanels: number }
```

Additional event observables can be merged into the model:

```ts
const model = createDockAndFlowModel(100, [externalEvents$])
```

## Verification

```sh
pnpm --filter @hafley66/react-dock-and-flow check
pnpm --filter @hafley66/react-dock-and-flow test
pnpm --filter @hafley66/react-dock-and-flow build
pnpm --filter @hafley66/react-dock-and-flow test:perf
```

The Playwright receipt exercises 500 logical React Flow nodes, verifies viewport culling, and verifies panel state retention.

## License

MIT
