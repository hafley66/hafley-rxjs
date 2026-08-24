# SVG-first graph board and sequence diagram package partition

Status: discussion plan for Sol review. No implementation worktrees or package moves are created by this document.

## 0. Decision under review

Keep the existing `@hafley66/grapht` package as the benchmark and experiment
harness. Add a framework-free `@hafley66/grapht-model` package for the stable
graph artifact, topology, geometry, placement, and reconciliation contracts.

Add source-language adapters as separate packages:

```text
@hafley66/mmd  -> Mermaid source, native SVG render, SVG identity mapping
@hafley66/d2   -> D2 source, native SVG render, SVG identity mapping
```

Put the movable board and SVG/CSS interaction layer above the model package.
The first board projection can be implemented in Instant's existing Markdown
surface. A reusable `@hafley66/grapht-board` package becomes a separate package
when the board surface has enough code to justify extraction.

The first renderer path is SVG. Canvas, PixiJS, React Flow, and other renderer
experiments consume the model contracts later.

## 1. System map

```text
Mermaid source -> @hafley66/mmd --+
                                  +--> GraphArtifact
D2 source -----> @hafley66/d2 ---+
                                        |
                                        v
                              native SVG auto-layout
                                        |
                                        v
                               SVG identity decoration
                                        |
                                        v
                              browser SVG measurement
                                        |
                                        v
                               GraphRevision geometry
                                        |
                                        v
                              BoardReconciler
                                        |
                                        v
                       movable SVG/DOM board projection
```

The source adapter owns language syntax and native renderer behavior. The
model package owns stable semantic identity and interchange data. The browser
projection owns DOM measurement, CSS, pointer handling, sticky actor labels,
and editable overlays. The benchmark harness owns process execution, receipts,
timing, and comparison.

## 2. Package boundaries

### `@hafley66/grapht`

Current package role:

- benchmark protocol and JSONL process harness
- fixture generation
- geometry artifact file protocol
- renderer and layout experiment receipts

Future dependency:

```text
@hafley66/grapht -> @hafley66/grapht-model
```

Benchmark implementations consume model inputs and produce model-compatible
layout, render, geometry, or projection outputs. The benchmark protocol does
not become the semantic graph model.

### `@hafley66/grapht-model`

Framework-free model package. It has no React, DOM, browser, Tauri, or renderer
dependency.

Proposed source order:

```text
packages/grapht-model/
  package.json
  README.md
  src/
    0_types.ts
    1_topology.ts
    2_geometry.ts
    3_artifact.ts
    4_layout.ts
    5_reconcile.ts
    6_sequence.ts
    7_interfaces.ts
    index.ts
  tests/
    0_types.test.ts
    1_topology.test.ts
    2_geometry.test.ts
    3_artifact.test.ts
    4_reconcile.test.ts
    5_sequence.test.ts
```

### `@hafley66/mmd`

- Mermaid dependency ownership
- Mermaid source detection and sequence parsing
- native Mermaid SVG rendering
- Mermaid-specific SVG element identity recovery
- Mermaid-to-`GraphTopology` conversion

### `@hafley66/d2`

- D2 dependency ownership
- D2 compile and render calls
- D2 sequence object, group, span, note, actor, and edge extraction
- D2-specific SVG element identity recovery
- D2-to-`GraphTopology` conversion

### Board projection

The first implementation can remain in Instant's `packages/md` because the
current lightbox already owns SVG insertion, pan, zoom, and diagram CSS. The
model-facing board API should be isolated behind a component boundary so it can
move into `@hafley66/grapht-board` later.

Board responsibilities:

- render the measured SVG artifact
- maintain camera state
- measure SVG elements in the browser
- apply sticky actor headers
- resolve hover focus through stable IDs
- collapse and expand groups
- render editable HTML/SVG overlays
- persist placement changes through a placement journal

## 3. Core type signatures

### Topology

```ts
export type GraphLanguage = "mermaid" | "d2";
export type EntityId = string;
export type RevisionId = string;
export type ArtifactId = string;

export type GraphEntity = {
  id: EntityId;
  kind: "actor" | "message" | "activation" | "group" | "note" | "node" | "edge";
  label?: string;
  parentId?: EntityId;
  sourceSpan?: SourceSpan;
};

export type GraphRelation = {
  id: EntityId;
  kind: "message" | "edge" | "contains" | "activates" | "branch";
  sourceId: EntityId;
  targetId: EntityId;
  parentId?: EntityId;
};

export type GraphTopology = {
  language: GraphLanguage;
  entities: GraphEntity[];
  relations: GraphRelation[];
  sourceSpans: SourceSpan[];
};

export type SourceSpan = {
  start: number;
  end: number;
  lineStart?: number;
  lineEnd?: number;
};
```

### Rendered artifact and SVG binding

```ts
export type SvgBinding = {
  entityId: EntityId;
  role: "shape" | "label" | "line" | "arrow" | "lifeline" | "frame";
  selector: string;
};

export type RenderedArtifact = {
  artifactId: ArtifactId;
  revisionId: RevisionId;
  language: GraphLanguage;
  source: string;
  svg: string;
  topology: GraphTopology;
  svgBindings: SvgBinding[];
};
```

### Geometry

```ts
export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };

export type EntityGeometry = {
  entityId: EntityId;
  bounds: Rect;
  points?: Point[];
  sourceSvgSelectors: string[];
};

export type GeometrySnapshot = {
  viewBox: Rect;
  entities: EntityGeometry[];
};
```

### Layout and renderer interfaces

```ts
export type LayoutInput = {
  topology: GraphTopology;
  previous?: GeometrySnapshot;
};

export type LayoutOutput = {
  geometry: GeometrySnapshot;
  implementation: string;
};

export interface GraphLayoutEngine {
  readonly id: string;
  layout(input: LayoutInput): Promise<LayoutOutput>;
}

export type RenderOptions = {
  dark: boolean;
  signal?: AbortSignal;
};

export interface GraphSourceAdapter<L extends GraphLanguage = GraphLanguage> {
  readonly language: L;
  parse(source: string): Promise<GraphTopology>;
  render(source: string, options: RenderOptions): Promise<RenderedArtifact>;
}

export interface SvgMeasurer<Input = unknown> {
  measure(input: Input, artifact: RenderedArtifact): GeometrySnapshot;
}
```

### Placement and reconciliation

```ts
export type BoardPlacement = {
  entityId: EntityId;
  rect: Rect;
  manual: boolean;
};

export type BoardRevision = {
  graphRevisionId: RevisionId;
  placements: BoardPlacement[];
  collapsedGroupIds: EntityId[];
};

export type ReconciliationResult = {
  retained: EntityId[];
  inserted: EntityId[];
  removed: EntityId[];
  placements: BoardPlacement[];
};

export interface BoardReconciler {
  reconcile(
    previous: BoardRevision | undefined,
    next: { revisionId: RevisionId; geometry: GeometrySnapshot },
  ): ReconciliationResult;
}
```

### Sequence focus and collapse

```ts
export type SequenceGroupKind =
  | "loop"
  | "alt"
  | "opt"
  | "par"
  | "critical"
  | "break"
  | "rect"
  | "box"
  | "d2-group";

export type SequenceFocus = {
  hoveredEntityId?: EntityId;
  actorIds: EntityId[];
  groupIds: EntityId[];
};

export type SequenceCollapseState = {
  collapsedGroupIds: EntityId[];
};

export function resolveSequenceFocus(
  topology: GraphTopology,
  entityId: EntityId,
): SequenceFocus;

export function toggleSequenceGroup(
  state: SequenceCollapseState,
  groupId: EntityId,
): SequenceCollapseState;
```

## 4. Pseudo-code bodies

### Source adapter

```ts
// Parse the source with the language implementation.
// Assign stable semantic IDs from source identity and source spans.
// Render using native auto-layout.
// Locate renderer-specific SVG elements.
// Emit source topology, raw SVG, and SVG bindings together.
```

### Browser measurement

```ts
// Parse the SVG viewBox.
// Resolve each binding selector against the mounted SVG.
// Read getBBox() and path geometry where applicable.
// Convert renderer coordinates into viewBox coordinates.
// Emit one immutable GeometrySnapshot.
```

### Reconciliation

```ts
// Match next geometry entities by stable EntityId.
// Retain manual placements for matched entities.
// Seed inserted entities from next SVG geometry.
// Drop placements for removed entities.
// Preserve collapsed group IDs whose entities remain present.
// Return an explicit retained/inserted/removed receipt.
```

### Sequence interaction

```ts
// Pointer enters a decorated message or activation element.
// Read its EntityId from data-seq-entity.
// Resolve related actor IDs through GraphTopology.
// Mark matching SVG elements and HTML actor labels active.
// Show an offscreen actor in the fixed focus strip.
// Keep pointer movement in direct DOM writes.
```

### Group collapse

```ts
// Toggle one normalized group ID.
// Keep the group frame and label visible.
// Hide or replace its child rows in the SVG projection.
// Translate following rows by the measured collapsed delta.
// Update the world viewBox and board geometry.
// Preserve actor header coordinates.
```

## 5. Instance timelines and lifetimes

### Render lifetime

```text
source revision arrives
  -> source adapter parse/render starts
  -> previous render can be superseded by AbortSignal
  -> RenderedArtifact resolves
  -> SVG mounts
  -> browser measurement runs once after mount
  -> GraphRevision becomes available
  -> BoardReconciler creates BoardRevision
```

The raw SVG artifact is immutable. Camera, hover, collapse, and placement state
are mutable view or board state. A new source revision creates a new artifact
and geometry snapshot.

### Interaction lifetime

```text
board mounts
  -> SVG and actor header mount
  -> event delegation attaches to viewport
  -> measurement maps are retained by revision ID
  -> hover writes active data attributes
  -> collapse writes board state and geometry projection
  -> board unmount removes listeners and pointer capture
```

### Benchmark lifetime

```text
grapht-bench receives normalized topology or fixture
  -> adapter process receives protocol input
  -> adapter emits layout/render/geometry samples
  -> harness records timing and artifact receipts
  -> model-compatible output is checked before comparison
```

## 6. Storage and uniqueness

| State | Storage | Reads | Writes | Unique key |
|---|---|---|---|---|
| Source text | host document/file state | source adapter | file/watch or editor update | normalized source locator plus revision hash |
| Graph topology | `GraphRevision` | board, layout, focus | source adapter | artifact revision ID |
| Raw SVG | `RenderedArtifact` | SVG projection, export | source adapter | language plus source hash plus render options hash |
| SVG geometry | `GeometrySnapshot` | board placement, hit testing | browser measurer | artifact revision ID |
| Manual placement | `BoardRevision` or placement journal | board projection, reconciliation | drag/edit events | entity ID plus board/view ID |
| Collapse state | `BoardRevision` | sequence projection | group toggle | board/view ID plus group ID |
| Hover focus | ephemeral viewport state | CSS and actor overlay | pointer/focus events | mounted viewport ID |
| Benchmark receipt | `@hafley66/grapht` run directory | comparison tooling | harness | run ID plus implementation ID |

Manual placements and source geometry have separate write paths. Source layout
seeds positions. User movement writes placement state. A later source revision
reconciles by EntityId.

## 7. Worktree partition after review

Create these only after Sol reviews the plan:

```text
hafley-rxjs/.worktrees/grapht-model-sequence-core
  branch: feature/grapht-model-sequence-core
  owns: grapht-model contracts, sequence model, reconciliation tests

hafley-rxjs/.worktrees/mmd-d2-adapters
  branch: feature/mmd-d2-adapters
  owns: @hafley66/mmd, @hafley66/d2, SVG identity fixtures

instant/.worktrees/sequence-board-e2e
  branch: feature/sequence-board-e2e
  owns: md integration, SVG/CSS board projection, browser receipts
```

The first implementation pass should use disjoint write sets:

1. Core model types and reconciliation.
2. Mermaid and D2 adapters.
3. Instant board projection and E2E harness.

## 8. E2E receipt contract

The first browser receipt set should include both languages and both sequence
group families:

```text
receipts/sequence-board/
  mermaid-wide.json
  mermaid-wide.png
  mermaid-nested-groups.json
  d2-wide.json
  d2-wide.png
  d2-nested-groups.json
  reconcile-manual-placement.json
  hover-offscreen-actor.json
  activation-offscreen-actor.json
  collapse-expand.json
```

Each JSON receipt records:

```ts
type SequenceBoardReceipt = {
  language: "mermaid" | "d2";
  sourceHash: string;
  actorIds: string[];
  groupIds: string[];
  geometryEntityCount: number;
  focusedEntityId?: string;
  focusedActorIds?: string[];
  collapsedGroupIds?: string[];
  manualPlacementRetained?: string[];
  screenshotPath?: string;
};
```

Acceptance observations:

- actor names remain visible while reviewing a vertically long sequence
- edge hover marks both related actors active
- activation hover marks its actor active
- horizontally offscreen actors appear in the focus strip
- group collapse reduces the rendered sequence world height
- expansion restores the prior geometry
- manual placement survives a source revision when EntityId survives
- Mermaid and D2 produce the same normalized focus and placement behavior

## 9. Sol review questions

1. Does `grapht-model` contain the correct stable contract boundary while
   `grapht` remains the benchmark harness?
2. Should `SvgBinding` remain in the framework-free model package, or should
   binding recovery be a separate `grapht-svg` package?
3. Should the first board implementation stay in Instant's `packages/md`, or
   should `grapht-board` be created before the first E2E slice?
4. Does the proposed identity and reconciliation model preserve manual board
   edits across Mermaid and D2 source revisions?
5. Which part of the first E2E receipt set should become the initial gate?

## 10. Sol review result

Review agent: `gpt-5.6-sol`, one read-only pass on 2026-08-22.

### Retain

- Option B package boundary.
- Framework-free `grapht-model` contracts.
- `mmd` and `d2` source adapters.
- SVG-first native layout, measurement, and board projection.
- Initial board integration through Instant's existing lightbox seam.
- Direct DOM focus attributes with CSS `:has()` for viewport presentation.
- Separate source geometry and manual placement write paths.

### Required changes before implementation

1. Split `SourceRevision`, `RenderRevision`, `GeometrySnapshot`, and
   `BoardRevision`. The current artifact type combines separate lifetimes.
2. Define identity laws before reconciliation:
   authored language ID, stable alias, scoped structural fingerprint, then
   revision-local matching. Repeated or ambiguous Mermaid messages receive
   explicit ambiguity records.
3. Make the general language field extensible. Sequence domains can use a
   separate discriminant without requiring a model package union edit for every
   future adapter.
4. Give every selectable object one addressable entity ID. Relations reference
   entities rather than sharing the entity/relation `message` and `edge` roles.
5. Add versioned runtime schemas, such as `grapht-model/0`, so worker, Wasm,
   Rust, and subprocess benchmark implementations share validation rules.
6. Keep the serialized SVG binding contract in `grapht-model`; keep binding
   recovery and decoration inside `mmd` and `d2`; keep browser measurement in
   the board layer.
7. Qualify geometry with coordinate space and record local bounds, world bounds,
   transforms, and paths where required by hit testing.
8. Replace `manual: boolean` with placement provenance, base geometry revision,
   view ID, and an explicit absolute-versus-delta policy.
9. Stack worktrees by dependency: model first, adapters second, Instant
   integration third. Define the pnpm handoff between the two repositories.
10. Expand receipts with schema version, fixture/source hashes, adapter and
    renderer versions, browser/DPR/theme/font facts, revision IDs, ordered
    entity and binding records, camera state, actor client rectangles, collapse
    height deltas, placement reconciliation, and ambiguity records.

### First implementation gate

Use one equivalent wide three-actor Mermaid and D2 sequence. The first browser
gate covers normalized identity, decorated bindings, actor labels after vertical
movement, message hover activating both endpoints, and a horizontally offscreen
endpoint appearing in the focus overlay.

Group collapse and editable per-entity movement follow after identity,
measurement, and board projection pass this gate. The current virtual lightbox
pan model uses `viewBox` mutation and `overflow: hidden`, so sticky actor labels
there require a camera-synchronized HTML overlay. Inline document diagrams can
use document scrolling for native CSS sticky behavior.

### Open decisions

- Matching policy for repeated or reordered Mermaid messages.
- Absolute placement versus delta-from-layout placement after a source update.
- Whether the initial board projection remains in Instant `packages/md` or is
  extracted into `grapht-board` before the first browser gate.
- The package handoff mechanism from hafley-rxjs's pnpm workspace to Instant's
  local `file:` dependency setup.

## 11. First implementation slice

Worktrees:

```text
hafley-rxjs/.worktrees/grapht-model-sequence-core
  feature/grapht-model-sequence-core

instant/.worktrees/sequence-board-e2e
  feature/sequence-board-e2e
```

Implemented in the first slice:

- `@hafley66/grapht-model` types, Zod schemas, identity matching, placement
  reconciliation, sequence focus, and group state.
- `@hafley66/grapht` type re-exports and workspace dependency.
- Instant SVG bindings for Mermaid and D2 messages, actor labels, and Mermaid
  activation bars.
- HTML actor strip using CSS `position: sticky`, CSS `:has()` focus styling,
  actor focus overlay, sticky toggle, and group collapse controls.
- Terminal overlay and Markdown lightbox both pass source code into the same
  sequence decoration path.
- Playwright receipt covering Mermaid and D2 actor retention, message focus,
  activation focus, sticky toggle, `:has()` state, and collapse state.

Passing gates:

```text
@hafley66/grapht-model typecheck: pass
@hafley66/grapht-model test: 5 tests pass
Instant tsc: pass
Instant build: pass
Instant sequence Playwright receipt: pass
```

Existing environment-sensitive failures recorded during the full regression
run:

- `packages/md/src/0_diagramTheme.test.ts` has one Mermaid theme snapshot
  mismatch because the installed Mermaid version emits additional sequence
  theme variables.
- Five existing terminal diagram regression assertions fail under the current
  local renderer/timing state. The new sequence receipt passes independently.
- `@hafley66/grapht` existing shell-pipeline suite has six failures unrelated to
  the new model package; its typecheck passes.

Remaining partition work is the dedicated `@hafley66/mmd` and `@hafley66/d2`
adapter packages, browser SVG measurement, actual world-height reduction on
collapse, and editable board placements.
