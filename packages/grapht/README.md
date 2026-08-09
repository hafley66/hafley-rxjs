# grapht

`grapht` is the graph-document, geometry, revision, and projection module being extracted
from [Instant](../../../instant/README.md). Instant remains the first host and fixture source;
this package owns the reusable state model so Instant can shed graph, canvas, and rendered
artifact mechanics from its application composition root.

The working documents are ordered by dependency:

0. [`0_rendered_artifact_state_epic.d2`](./0_rendered_artifact_state_epic.d2) records the
   scope, repository seams, state flow, geometry mechanics, and delivery slices.
1. [`1_app_model.d2`](./1_app_model.d2) describes the application in TypeScript declaration
   shapes, including lifetimes, storage, reads, writes, and uniqueness.
2. [`2_instant_extraction_plan.d2`](./2_instant_extraction_plan.d2) records extraction of
   Instant's network/subagent trace viewer, canonical grid projection, Markdown viewer, and
   reusable whole-app live probe.

Both are D2 input fixtures. Markdown labels retain the plan while stable dotted D2 IDs make
every section addressable by parsers, renderers, diffs, and later message-carried edits.

## Scope

- Capture D2 and Mermaid sources from files, Git revisions, Markdown fences, or cached AI
  output.
- Retain immutable artifact revisions, source spans, stable entity IDs, topology, and
  provenance.
- Render source languages to SVG and extract SVG geometry without discarding the original
  source-language structure.
- Project normalized entities into SVG, Cytoscape, or XYFlow/React Flow.
- Keep rectangular grid, Dockview, sparse canvas, and detached-window placement in a
  separate placement plane.
- Diff revisions by entity identity and animate retained, entering, exiting, and updated
  entities.
- Journal source revisions and human placement edits so state can be reconstructed at any
  point in time.
- Index Markdown structurally through headings, blocks, tables, lists, code fences, links,
  authored IDs, and byte spans.

Graph embeddings, graph2vec, node2vec, semantic clustering, and inferred-link generation are
deferred. The initial index is deterministic and source-addressable.

## Package boundary

```ts
type ArtifactId = string
type RevisionId = string
type EntityId = string
type ViewId = string

type ArtifactRevision = {
  artifactId: ArtifactId
  revisionId: RevisionId
  parentRevisionIds: RevisionId[]
  source: SourceRef
  contentHash: string
  capturedAt: string
}

type Placement = {
  viewId: ViewId
  entityId: EntityId
  mode: "dock" | "grid" | "canvas" | "window" | "svg"
  rect?: { x: number; y: number; width: number; height: number }
  z?: number
  parentViewId?: ViewId
}
```

Runtime handles such as DOM nodes, React components, Cytoscape instances, and Dockview
panels remain outside serialized state. React may provide the first projection adapters;
the durable model, parser output, diffs, geometry, and event journal remain framework-free.

## State flow

```d2
direction: down

input: {
  label: "D2 / Mermaid / Markdown / Git revisions"
  shape: document
}

capture: {
  label: "capture + structural parse"
}

state: {
  label: "durable state"
  topology: {
    label: "entity topology + immutable revisions"
    shape: stored_data
  }
  placement: {
    label: "placement journal"
    shape: stored_data
  }
}

render: {
  label: "render"
  svg: {
    label: "SVG rendering"
    shape: document
  }
  geometry: {
    label: "geometry extraction"
  }
}

projection: {
  label: "SVG / Cytoscape / XYFlow"
}

host: {
  label: "Dockview / grid / canvas / window"
}

input -> capture -> state.topology
state.topology -> render.svg -> render.geometry -> projection
state.topology -> projection
state.placement -> projection
projection -> host
```

Source topology and human placement have separate write paths. Moving a projected node writes
a placement event. Rewriting D2 requires an explicit source-edit operation. A later source
revision reconciles stable entity IDs with the retained placement view.

## Existing seams

| Repository | Material feeding `grapht` |
|---|---|
| [`instant`](../../../instant/) | Host shell, Dockview, D2/Mermaid preview, file watching, persistence experiments, terminal/file/media resources, canvas/window algebra, command bus |
| [`anim`](../../../anim/) | Atlas model, keyed transitions, tours, D2 ingestion, Cytoscape rendering, synchronized panels, Git-to-frame machinery |
| [`sprefa`](../../../sprefa/) | Stable relational identities, graph facts, D2 emitters, graph queries, VS Code flow panel, revision-aware projections |
| [`react-dock-and-flow`](../react-dock-and-flow/) | Signal-driven Dockview and XYFlow composition, rectangle state, React projection, viewport-culling receipt |

## Source documents

- [`instant/docs/2026-08-06-agent-spatial-canvas-research.md`](../../../instant/docs/2026-08-06-agent-spatial-canvas-research.md)
- [`instant/plans/2026-08-08-canvas-state-ideas.md`](../../../instant/plans/2026-08-08-canvas-state-ideas.md)
- [`instant/chat_log/20260808.1.instant-rectangle-window-graph.md`](../../../instant/chat_log/20260808.1.instant-rectangle-window-graph.md)
- [`sprefa/plans/2026-08-08-d2-svg-cytoscape-report.md`](../../../sprefa/plans/2026-08-08-d2-svg-cytoscape-report.md)
- [`sprefa/plans/2026-08-08-d2-git-time-animation.md`](../../../sprefa/plans/2026-08-08-d2-git-time-animation.md)
- [`anim/REPORT-D2ANIM-A.md`](../../../anim/REPORT-D2ANIM-A.md)
- [`anim/atlas/DESIGN.md`](../../../anim/atlas/DESIGN.md)
- [`anim/atlas/CORE-README.md`](../../../anim/atlas/CORE-README.md)
- [`anim/DESIGN.md`](../../../anim/DESIGN.md)
- [`sprefa/plans/2026-06-06-graph-viz-atlas.md`](../../../sprefa/plans/2026-06-06-graph-viz-atlas.md)
- [`sprefa/plans/2026-05-18-pr-causal-map-animation.md`](../../../sprefa/plans/2026-05-18-pr-causal-map-animation.md)

Plans refer to `sprefa/REPORT-D2ANIM-B.md`, which is absent. The corresponding findings are
recorded in `sprefa/plans/2026-08-08-d2-svg-cytoscape-report.md`.

## Initial delivery order

0. Git-backed D2 revision fixture with expected entity diffs.
1. Artifact, revision, entity, source-span, and placement types.
2. D2 parse, render, SVG identity recovery, and geometry extraction.
3. Framework-free normalized graph and revision diff.
4. Cytoscape and XYFlow projection adapters.
5. Keyed geometry transitions for retained, entering, and exiting entities.
6. Placement journal and source-revision reconciliation.
7. Deterministic Markdown structural index.
8. Message-carried entity patches and authority rules, after the separate output protocol is
   available.
