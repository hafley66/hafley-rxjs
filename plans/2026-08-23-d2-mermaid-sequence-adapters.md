# D2 and Mermaid sequence adapter decomposition

Status: planning

This plan replaces the combined sequence-board implementation swing with
independently testable source, identity, rendering, binding, geometry, and
projection problems.

Existing work remains reference material:

- `plans/2026-08-22-svg-board-sequence-partition.md`
- `feature/grapht-model-sequence-core` at `f0fe416`
- Instant `feature/sequence-board-e2e` through `51b2079`

No existing branch is the integration base until the source and SVG receipts
in sections 0 and 1 pass.

## Dependency order

```text
0 equivalent fixtures
  |
  +--> 1a Mermaid native receipt --> 2a Mermaid local document --> 4a Mermaid SVG bindings
  |
  +--> 1b D2 native receipt ------> 2b D2 local document ------> 4b D2 SVG bindings
                                      |
                                      v
                               3 occurrence identity
                                      |
                                      v
                              5 shared artifact
                                      |
                         +------------+------------+
                         v                         v
                  6 browser geometry        7 focus resolution
                         +------------+------------+
                                      v
                               8 board projection
                                      |
                               +------+------+
                               v             v
                         9a collapse    9b placement
```

## 0. Equivalent source fixtures

### Type signatures

```ts
type FixtureLanguage = "mermaid" | "d2"

type ExpectedOccurrence = {
  fixtureKey: string
  kind: "actor" | "message" | "group" | "activation" | "note"
  parentFixtureKey?: string
  sourceActorFixtureKey?: string
  targetActorFixtureKey?: string
  label?: string
}

type SequenceFixture = {
  language: FixtureLanguage
  source: string
  expectedOccurrences: ExpectedOccurrence[]
}

type EquivalentFixturePair = {
  mermaid: SequenceFixture
  d2: SequenceFixture
}
```

### Fixture contents

Both sources express:

- three actors
- two repeated messages with the same label and endpoints
- one self-message
- one nested group
- one activation or span
- one note
- one actor positioned outside the initial horizontal viewport

### Lifetime

Fixtures are immutable checked artifacts. Revisions derived from a fixture are
separate files rather than runtime mutations.

### Storage and uniqueness

```text
fixture identity = language + fixture filename
occurrence expectation identity = fixtureKey within one fixture
```

### Definition of done

- One Mermaid source and one D2 source exist under a shared fixture directory.
- Both render successfully with the repository-pinned native renderer versions.
- The expectation documents contain the same occurrence keys for equivalent
  language concepts.
- Repeated messages have distinct fixture keys despite sharing labels and
  endpoints.
- Fixture sources and expectations pass inline or file snapshots.
- No normalized runtime entity IDs are selected in this step.

## 1. Native renderer receipts

### Type signatures

```ts
type NativeSvgElement = {
  path: number[]
  tag: string
  id?: string
  classes: string[]
  text?: string
  attributes: Record<string, string>
}

type NativeRenderReceipt = {
  language: FixtureLanguage
  rendererPackage: string
  rendererVersion: string
  sourceHash: string
  svgHash: string
  svg: string
  elements: NativeSvgElement[]
}

declare function renderMermaidReceipt(source: string): Promise<NativeRenderReceipt>
declare function renderD2Receipt(source: string): Promise<NativeRenderReceipt>
```

### Body pseudocode

```ts
// Render with the pinned language renderer and deterministic options.
// Preserve the unmodified native SVG.
// Walk the SVG in document order.
// Record structural paths, identifiers, classes, text, and relevant attributes.
// Hash the source and complete SVG.
```

### Lifetime

One receipt belongs to one source hash, renderer version, theme, font set, and
render option set. A renderer upgrade creates a new receipt.

### Storage and uniqueness

```text
receipt identity = language + sourceHash + rendererVersion + renderOptionsHash
element identity inside receipt = document-order structural path
```

### Definition of done

- Mermaid and D2 native SVG files are checked artifacts.
- Structural element receipts are checked beside each SVG.
- Receipts record renderer version, source hash, SVG hash, and deterministic
  options.
- Every expected actor, message, group, activation or span, and note has at
  least one visually corresponding receipt element documented by a test.
- A revision inserting one earlier message has its own receipt.
- Tests report which native SVG identifiers remain stable across that revision.
- No SVG mutation or normalized binding occurs in this step.

## 2. Language-local semantic documents

### Type signatures

```ts
type SourceSpan = {
  start: number
  end: number
  lineStart: number
  lineEnd: number
}

type MermaidSequenceDocument = {
  participants: MermaidParticipant[]
  statements: MermaidStatement[]
}

type D2SequenceDocument = {
  actors: D2Actor[]
  edges: D2Edge[]
  groups: D2Group[]
  spans: D2Span[]
  notes: D2Note[]
}

declare function parseMermaidSequence(source: string): MermaidSequenceDocument
declare function parseD2Sequence(source: string): D2SequenceDocument
```

### Body pseudocode

```ts
// Parse with the language-owned parser or compiler output.
// Preserve declaration order and source spans.
// Preserve language-local group, activation, edge, alias, and note forms.
// Emit diagnostics for unsupported or recovered syntax.
```

### Lifetime

A local document belongs to one exact source revision. It contains no browser
nodes and no renderer SVG references.

### Storage and uniqueness

Local nodes use source-local keys and ordinals. These keys do not claim
cross-revision stability.

### Definition of done

- Mermaid parsing produces every expected participant and statement in source
  order.
- D2 parsing produces every expected actor, edge, group, span, and note in
  source order.
- Every parsed occurrence has a source span or an explicit diagnostic stating
  why the parser cannot supply one.
- Repeated messages remain two separate local nodes.
- Nested groups preserve their containment structure.
- Local document snapshots contain no shared `GraphEntity` or
  `SequenceOccurrence` types.
- Invalid-source fixtures produce deterministic diagnostics.

## 3. Occurrence identity and revision matching

### Type signatures

```ts
type SequenceOccurrence = {
  id: string
  kind: "actor" | "message" | "group" | "activation" | "note"
  parentId?: string
  ordinal: number
  sourceSpan?: SourceSpan
  authoredId?: string
  structuralKey: string
  label?: string
}

type IdentityAmbiguity = {
  nextOccurrenceId: string
  candidatePreviousIds: string[]
  reason: "repeated-structure" | "reordered-structure" | "missing-source-identity"
}

type IdentityReceipt = {
  retained: string[]
  inserted: string[]
  removed: string[]
  ambiguities: IdentityAmbiguity[]
}

declare function identifyMermaidOccurrences(
  document: MermaidSequenceDocument,
): SequenceOccurrence[]

declare function identifyD2Occurrences(
  document: D2SequenceDocument,
): SequenceOccurrence[]

declare function matchSequenceRevisions(
  previous: SequenceOccurrence[],
  next: SequenceOccurrence[],
): IdentityReceipt
```

### Identity precedence

```text
1 authored language ID
2 stable language alias
3 scoped structural fingerprint
4 revision-local ordinal
5 explicit ambiguity
```

### Revision fixtures

```text
A original
B insert unrelated message before repeated messages
C reorder repeated messages
D rename one repeated message
E move one message into a group
F remove one repeated message
```

### Lifetime

Occurrences belong to one source revision. A match receipt connects exactly two
ordered revisions and is immutable.

### Storage and uniqueness

```text
occurrence ID uniqueness = one source revision
match uniqueness = previousRevisionId + nextRevisionId
```

### Definition of done

- Every local semantic node lowers to one addressable occurrence.
- Occurrence IDs are unique within a revision.
- Relations reference existing occurrence IDs.
- All six revision fixtures have inline identity receipts.
- Repeated and reordered Mermaid messages produce explicit ambiguity records
  whenever the available source data cannot select one prior occurrence.
- D2 authored IDs remain stable when unrelated earlier statements are inserted.
- Ambiguous matches never silently retain manual placement.
- Matching results are deterministic across repeated runs.

## 4. Language-specific SVG binding recovery

### Type signatures

```ts
type SvgBindingRole =
  | "actor-shape"
  | "actor-label"
  | "lifeline"
  | "message-line"
  | "message-label"
  | "group-frame"
  | "group-label"
  | "activation"
  | "note-shape"
  | "note-label"

type SvgBinding = {
  occurrenceId: string
  role: SvgBindingRole
  elementId: string
  ordinal: number
}

type SvgBindingReceipt = {
  bindings: SvgBinding[]
  unboundOccurrenceIds: string[]
  multiplyBoundOccurrenceIds: string[]
  unclaimedElementPaths: number[][]
}

declare function bindMermaidSvg(
  document: MermaidSequenceDocument,
  occurrences: SequenceOccurrence[],
  receipt: NativeRenderReceipt,
): SvgBindingReceipt

declare function bindD2Svg(
  document: D2SequenceDocument,
  occurrences: SequenceOccurrence[],
  receipt: NativeRenderReceipt,
): SvgBindingReceipt
```

### Body pseudocode

```ts
// Use language-specific source ordering and renderer structure.
// Assign deterministic element IDs when native SVG lacks usable IDs.
// Keep multiple visual roles for one occurrence as separate bindings.
// Report missing and ambiguous bindings instead of guessing.
```

### Lifetime

A binding receipt belongs to one occurrence set and one native render receipt.
It is invalid after either source identity or renderer output changes.

### Storage and uniqueness

```text
binding identity = occurrenceId + role + ordinal
element identity = decorated elementId within one render revision
```

### Definition of done

- Mermaid and D2 binding functions are separate implementations.
- Every expected fixture occurrence has the required binding roles.
- Repeated messages bind to distinct message lines and labels.
- Actor labels, shapes, and lifelines bind to the same actor occurrence.
- Nested group frames and labels bind to the correct group occurrence.
- Activation or span elements bind to their owning occurrence and actor.
- Insert-before revision tests preserve bindings for retained occurrences or
  report explicit ambiguity.
- Binding output contains no DOM element references.
- Decorated SVG validates as SVG and retains the native viewBox.

## 5. Shared sequence artifact

### Type signatures

```ts
type SequenceRelation = {
  id: string
  kind: "message" | "contains" | "activates"
  sourceId: string
  targetId: string
  ordinal: number
}

type SequenceArtifact = {
  protocol: "grapht-sequence/0"
  language: string
  sourceRevision: SourceRevision
  renderRevision: RenderRevision
  occurrences: SequenceOccurrence[]
  relations: SequenceRelation[]
  bindings: SvgBinding[]
}

interface SequenceSourceAdapter<LocalDocument> {
  readonly language: string
  parse(source: string): LocalDocument
  identify(document: LocalDocument): SequenceOccurrence[]
  render(source: string, options: RenderOptions): Promise<NativeRenderReceipt>
  bind(
    document: LocalDocument,
    occurrences: SequenceOccurrence[],
    receipt: NativeRenderReceipt,
  ): SvgBindingReceipt
}
```

### Body pseudocode

```ts
// Run parse, identify, render, and bind for one exact source revision.
// Validate every serialized boundary with a versioned schema.
// Keep language-local documents outside the serialized shared artifact.
// Return diagnostics and ambiguity receipts beside the artifact.
```

### Lifetime

Source revision, render revision, binding receipt, and artifact remain separate
immutable records. Superseded async rendering is cancelled by `AbortSignal`.

### Storage and uniqueness

```text
source revision = locator + sourceHash + adapterVersion
render revision = sourceRevisionId + rendererVersion + renderOptionsHash
artifact = sourceRevisionId + renderRevisionId + protocol version
```

### Definition of done

- Mermaid and D2 adapters implement the same interface.
- Equivalent fixtures produce the same occurrence kinds and relation topology.
- All serialized outputs pass `grapht-sequence/0` runtime schemas.
- Source, render, and binding revisions have separate IDs.
- Renderer and adapter versions appear in receipts.
- Cancellation prevents a superseded render from becoming the current artifact.
- Package tests consume only public adapter exports.

## 6. Browser SVG measurement

### Type signatures

```ts
type EntityGeometry = {
  occurrenceId: string
  role: SvgBindingRole
  localBounds: Rect
  worldBounds: Rect
  transform: Matrix2D
  path?: Point[]
  elementId: string
}

type SequenceGeometry = {
  id: string
  renderRevisionId: string
  coordinateSpace: "svg-viewBox"
  viewBox: Rect
  entities: EntityGeometry[]
}

declare function measureSequenceSvg(
  artifact: SequenceArtifact,
  svg: SVGSVGElement,
): SequenceGeometry
```

### Body pseudocode

```ts
// Resolve each serialized binding against the mounted SVG.
// Read local bounds and current transformation matrices.
// Convert bounds and optional paths into viewBox world coordinates.
// Emit immutable geometry with no retained DOM references.
```

### Lifetime

Measurement starts after SVG mount and font readiness. It reruns for a new
render revision, font fact, or renderer-affecting viewport fact.

### Storage and uniqueness

```text
geometry identity = renderRevisionId + browserFactsHash + measurerVersion
```

### Definition of done

- Every binding resolves to exactly one mounted SVG element or produces a
  missing-element diagnostic.
- Local and world bounds are recorded for every resolved binding.
- Actor, message, group, activation, and note geometry counts match binding
  receipt counts.
- Geometry uses SVG viewBox coordinates independent of current CSS pixel size.
- Measurement retains no DOM nodes after the mounted SVG is released.
- Browser receipts record browser version, device pixel ratio, theme, and font
  readiness.

## 7. Sequence focus resolution

### Type signatures

```ts
type SequenceFocus = {
  hoveredOccurrenceId?: string
  actorIds: string[]
  groupIds: string[]
}

declare function resolveSequenceFocus(
  artifact: SequenceArtifact,
  occurrenceId: string,
): SequenceFocus
```

### Body pseudocode

```ts
// Find the selected occurrence.
// Follow message relations to source and target actors.
// Follow activation ownership to its actor.
// Walk containment parents to every enclosing group.
// Preserve artifact order in returned arrays.
```

### Lifetime

Focus is ephemeral view state. It is recomputed from the current immutable
artifact and is never serialized into source or geometry.

### Storage and uniqueness

At most one hovered occurrence exists per mounted viewport. Focus arrays contain
unique occurrence IDs in artifact order.

### Definition of done

- Message focus returns both endpoint actors.
- Self-message focus returns one actor once.
- Activation focus returns its actor.
- Nested message focus returns every containing group in parent order.
- Actor focus returns that actor.
- Missing occurrence focus returns empty actor and group arrays.
- Mermaid and D2 equivalent fixture occurrences produce equivalent focus
  receipts.
- The function performs no DOM reads or writes.

## 8. Initial board projection

### Type signatures

```ts
type SequenceBoardInput = {
  artifact: SequenceArtifact
  geometry: SequenceGeometry
}

type SequenceBoardState = {
  camera: CameraState
  focus: SequenceFocus
}

declare function createSequenceBoard(input: SequenceBoardInput): SequenceBoard
```

### Body pseudocode

```ts
// Mount the decorated SVG artifact.
// Project actor labels into a camera-synchronized HTML overlay.
// Delegate pointer focus through decorated element IDs.
// Apply focus data attributes with direct DOM writes.
// Keep camera and focus state local to this mounted board.
```

### Lifetime

One board instance belongs to one mounted viewport. A new artifact replaces its
SVG and geometry together. Unmount removes listeners and pointer capture.

### Storage and uniqueness

```text
board instance identity = viewportId
current content identity = artifact renderRevisionId + geometry id
```

### Definition of done

- One Mermaid artifact and one D2 artifact mount through the same board API.
- Actor labels remain visible after vertical camera movement.
- Hovering a message activates both endpoint actor labels.
- A horizontally offscreen endpoint appears in the focus overlay.
- Activation hover activates its actor label.
- Board replacement never mixes bindings from one render revision with geometry
  from another.
- Unmount removes every board-owned listener.
- Playwright JSON and PNG receipts pass for both languages.
- Collapse and manual placement behavior are absent from this gate.

## 9a. Group collapse projection

### Type signatures

```ts
type SequenceCollapseState = {
  collapsedGroupIds: string[]
}

declare function projectCollapsedSequence(
  artifact: SequenceArtifact,
  geometry: SequenceGeometry,
  state: SequenceCollapseState,
): SequenceGeometry
```

### Definition of done

- Collapsing retains the selected group frame and label.
- Descendant rows are hidden or replaced by one summary row.
- Following geometry moves upward by the measured collapsed delta.
- The resulting viewBox height decreases by that delta.
- Expanding restores the original geometry exactly.
- Nested collapse order is deterministic.
- Mermaid and D2 equivalent groups produce equivalent collapse receipts.

## 9b. Manual placement reconciliation

### Type signatures

```ts
type SequencePlacement = {
  viewId: string
  occurrenceId: string
  baseGeometryRevisionId: string
  delta: { x: number; y: number }
  source: "manual"
}

declare function reconcileSequencePlacements(
  previousArtifact: SequenceArtifact,
  nextArtifact: SequenceArtifact,
  identity: IdentityReceipt,
  placements: SequencePlacement[],
): ReconciliationResult
```

### Definition of done

- Placements are stored as deltas from one named geometry revision.
- Exact retained identity carries placement into the next revision.
- Inserted and removed occurrences never inherit placement.
- Ambiguous occurrences never inherit placement automatically.
- Rebased placement records name the next geometry revision.
- Reconciliation has fixtures for insert, reorder, rename, regroup, and remove.
- Mermaid and D2 use the same reconciliation function.

## Package gate

Package creation follows evidence from sections 0 through 4.

Provisional ownership:

```text
@hafley66/mmd
  Mermaid parser/compiler ownership
  Mermaid local document
  Mermaid native render receipt
  Mermaid SVG binding recovery

@hafley66/d2
  D2 compiler ownership
  D2 local document
  D2 native render receipt
  D2 SVG binding recovery

@hafley66/grapht-model
  versioned shared sequence artifact
  occurrence identity and matching
  focus resolution
  placement reconciliation

board layer
  browser measurement
  camera and focus projection
  collapse projection
  editable placement input
```

### Definition of done

- Package dependency direction matches the dependency graph in this plan.
- `grapht-model` has no Mermaid, D2, DOM, React, browser, or renderer dependency.
- `mmd` and `d2` depend on `grapht-model` only after the shared artifact gate.
- Browser measurement and board code contain no language parser dependency.
- Every package uses author-driven numeric source prefixes.
- Cross-package fixtures validate serialized outputs at package boundaries.

## Stop conditions

Stop the current subproblem when any of these occurs:

- the native renderer omits information required for one expected occurrence
- the language parser cannot provide required source ordering or spans
- repeated occurrences cannot be distinguished and lack an ambiguity receipt
- SVG bindings depend on browser geometry rather than renderer structure
- a shared type requires language-specific fields before both local documents
  have passing snapshots
- a board behavior requires collapse or placement before the initial board gate

Record the failed fixture and exact missing datum before changing a downstream
type or package boundary.
