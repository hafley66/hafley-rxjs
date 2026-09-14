# Every export

The public surface of `@hafley66/grapht` that the pages above this one describe: the graph frame, the sticky headers, the renderer contract, and the history journal. The bench protocol and renderer contracts are omitted, because a page here does not answer a question about them yet.

Read out of the TypeScript program by `packages/docs-kit/scripts/api.mjs`: the barrel names what is public, each module answers for what it declares, and the checker answers for every signature. Editing this file by hand is editing the thing that overwrites it.

## Modules

| module | exports | what it is |
| --- | --- | --- |
| [src/lib/0_graphStyle.ts](#src-lib-0-graphstyle-ts) | 6 | Shared graph colors for native primitives, document SVG, and screen-space headers. |
| [src/lib/1_graphStylesheet.ts](#src-lib-1-graphstylesheet-ts) | 2 | Cytoscape-compatible primitive rules are the shared style floor for canvas and SVG adapters. |
| [src/2_graph/15_groupLayout.ts](#src-2-graph-15-grouplayout-ts) | 6 | Per-group automatic-layout ownership, with retained manual positions across collapse/expand. |
| [src/2_graph/16_neighborhood.ts](#src-2-graph-16-neighborhood-ts) | 4 |  |
| [src/2_graph/17_groupProjection.ts](#src-2-graph-17-groupprojection-ts) | 3 |  |
| [src/2_graph/18_sequenceCollapse.ts](#src-2-graph-18-sequencecollapse-ts) | 1 |  |
| [src/2_graph/19_sequenceNeighborhood.ts](#src-2-graph-19-sequenceneighborhood-ts) | 1 |  |
| [src/2_graph/20_groupActors.ts](#src-2-graph-20-groupactors-ts) | 1 |  |
| [src/2_graph/0_frame.ts](#src-2-graph-0-frame-ts) | 6 | Render a graph from explicit geometry, camera, and presentation state. |
| [src/2_graph/1_fitCamera.ts](#src-2-graph-1-fitcamera-ts) | 1 |  |
| [src/2_graph/2_geometryScope.ts](#src-2-graph-2-geometryscope-ts) | 5 |  |
| [src/2_graph/3_sealedSvgArtifact.ts](#src-2-graph-3-sealedsvgartifact-ts) | 4 |  |
| [src/2_graph/4_svgGeometry.ts](#src-2-graph-4-svggeometry-ts) | 3 |  |
| [src/2_graph/5_translateGeometry.ts](#src-2-graph-5-translategeometry-ts) | 2 | Apply caller-owned manual offsets to captured graph geometry. |
| [src/2_graph/6_stackGroupHeaders.ts](#src-2-graph-6-stackgroupheaders-ts) | 3 |  |
| [src/2_graph/9_operators.ts](#src-2-graph-9-operators-ts) | 5 |  |
| [src/2_graph/10_renderer.ts](#src-2-graph-10-renderer-ts) | 4 | Project graph frames through one renderer resource for each stream lifetime. |
| [src/2_graph/13_foreignObjectText.ts](#src-2-graph-13-foreignobjecttext-ts) | 1 | d2 renders markdown labels as foreignObject HTML, which the sanitizers remove; each block becomes width-measured svg text instead. |
| [src/5_history/0_journal.ts](#src-5-history-0-journal-ts) | 6 |  |
| [src/5_history/1_gitWalk.ts](#src-5-history-1-gitwalk-ts) | 1 |  |
| [src/5_history/2_cli.ts](#src-5-history-2-cli-ts) | 1 |  |

## src/lib/0_graphStyle.ts

Shared graph colors for native primitives, document SVG, and screen-space headers.

| export | kind |
| --- | --- |
| [`GraphTheme`](#src-lib-0-graphstyle-ts-graphtheme) | type |
| [`GraphStyle`](#src-lib-0-graphstyle-ts-graphstyle) | type |
| [`GRAPH_STYLES`](#src-lib-0-graphstyle-ts-graph-styles) | const |
| [`GraphStyleInput`](#src-lib-0-graphstyle-ts-graphstyleinput) | type |
| [`GraphStyleResource`](#src-lib-0-graphstyle-ts-graphstyleresource) | interface |
| [`graphStyleOf`](#src-lib-0-graphstyle-ts-graphstyleof) | function |

### `GraphTheme` {#src-lib-0-graphstyle-ts-graphtheme}

`GraphTheme` is declared at `src/lib/0_graphStyle.ts:2`.

```ts
export type GraphTheme = "light" | "dark"
```

### `GraphStyle` {#src-lib-0-graphstyle-ts-graphstyle}

`GraphStyle` is declared at `src/lib/0_graphStyle.ts:5`.

Complete renderer-neutral palette. Spread a preset to customize individual colors.

```ts
export type GraphStyle = {
  canvasBackground: string
  ribbon: { fill: string; stroke: string; text: string }
  group: { fill: string; stroke: string; text: string }
  nodeBackground: string
  nodeBorder: string
  nodeText: string
  nodeOutline: string
  actorBackground: string
  actorBorder: string
  actorText: string
  lifelineBackground: string
  groupFrameBorder: string
  activationBackground: string
  activationBorder: string
  noteBackground: string
  noteBorder: string
  noteText: string
  parentBackground: string
  parentBorder: string
  edgeLine: string
  edgeText: string
  edgeTextBackground: string
  messageText: string
  messageTextBackground: string
  messageLine: string
  focusBorder: string
  focusBackground: string
  headerBackground: string
  headerBorder: string
  headerText: string
}

export function graphStyleOf(style: GraphStyleInput): GraphStyle
```

### `GRAPH_STYLES` {#src-lib-0-graphstyle-ts-graph-styles}

`GRAPH_STYLES` is declared at `src/lib/0_graphStyle.ts:38`.

```ts
GRAPH_STYLES: Readonly<Record<GraphTheme, GraphStyle>>
```

### `GraphStyleInput` {#src-lib-0-graphstyle-ts-graphstyleinput}

`GraphStyleInput` is declared at `src/lib/0_graphStyle.ts:106`.

Both renderer resources accept the same preset name or complete caller-owned palette.

```ts
export type GraphStyleInput = GraphTheme | GraphStyle

export function graphStyleOf(style: GraphStyleInput): GraphStyle
```

### `GraphStyleResource` {#src-lib-0-graphstyle-ts-graphstyleresource}

`GraphStyleResource` is declared at `src/lib/0_graphStyle.ts:108`.

```ts
export interface GraphStyleResource {
  /** Recolor the current view without replacing graph geometry, camera, or source artifact. */
  applyTheme(style: GraphStyleInput): void
}
```

### `graphStyleOf` {#src-lib-0-graphstyle-ts-graphstyleof}

`graphStyleOf` is declared at `src/lib/0_graphStyle.ts:114`.

Resolve a preset name once at the renderer boundary. Custom palettes are read without mutation.

```ts
graphStyleOf: (style: GraphStyleInput) => GraphStyle
```

## src/lib/1_graphStylesheet.ts

Cytoscape-compatible primitive rules are the shared style floor for canvas and SVG adapters.

| export | kind |
| --- | --- |
| [`GraphStyleRule`](#src-lib-1-graphstylesheet-ts-graphstylerule) | type |
| [`graphStylesheet`](#src-lib-1-graphstylesheet-ts-graphstylesheet) | function |

### `GraphStyleRule` {#src-lib-1-graphstylesheet-ts-graphstylerule}

`GraphStyleRule` is declared at `src/lib/1_graphStylesheet.ts:3`.

```ts
export type GraphStyleRule = { selector: string; style: Record<string, unknown> }

export function graphStylesheet(c: GraphStyle): GraphStyleRule[]
```

### `graphStylesheet` {#src-lib-1-graphstylesheet-ts-graphstylesheet}

`graphStylesheet` is declared at `src/lib/1_graphStylesheet.ts:6`.

Native Cytoscape consumes these rules directly. SVG maps supported primitive paint properties.

```ts
graphStylesheet: (c: GraphStyle) => GraphStyleRule[]
```

## src/2_graph/15_groupLayout.ts

Per-group automatic-layout ownership, with retained manual positions across collapse/expand.

| export | kind |
| --- | --- |
| [`GroupPositions`](#src-2-graph-15-grouplayout-ts-grouppositions) | type |
| [`GroupLayoutState`](#src-2-graph-15-grouplayout-ts-grouplayoutstate) | type |
| [`GroupLayoutEvent`](#src-2-graph-15-grouplayout-ts-grouplayoutevent) | type |
| [`reduceGroupLayout`](#src-2-graph-15-grouplayout-ts-reducegrouplayout) | function |
| [`groupAllowsAutoLayout`](#src-2-graph-15-grouplayout-ts-groupallowsautolayout) | function |
| [`groupPositionsOf`](#src-2-graph-15-grouplayout-ts-grouppositionsof) | function |

### `GroupPositions` {#src-2-graph-15-grouplayout-ts-grouppositions}

`GroupPositions` is declared at `src/2_graph/15_groupLayout.ts:4`.

```ts
export type GroupPositions = Readonly<Record<GraphId, GraphPoint>>

export function groupPositionsOf(state: GroupLayoutState, groupId: GraphId, automatic: GroupPositions): GroupPositions
```

### `GroupLayoutState` {#src-2-graph-15-grouplayout-ts-grouplayoutstate}

`GroupLayoutState` is declared at `src/2_graph/15_groupLayout.ts:5`.

```ts
export type GroupLayoutState = {
  /** UI toggle: checked means expansion resumes automatic layout. */
  autoOnExpand: boolean
  groups: Readonly<Record<GraphId, { collapsed: boolean; mode: "auto" | "manual"; manual?: GroupPositions }>>
}

export function reduceGroupLayout(state: GroupLayoutState, event: GroupLayoutEvent): GroupLayoutState
```

### `GroupLayoutEvent` {#src-2-graph-15-grouplayout-ts-grouplayoutevent}

`GroupLayoutEvent` is declared at `src/2_graph/15_groupLayout.ts:10`.

```ts
export type GroupLayoutEvent =

export function reduceGroupLayout(state: GroupLayoutState, event: GroupLayoutEvent): GroupLayoutState
```

### `reduceGroupLayout` {#src-2-graph-15-grouplayout-ts-reducegrouplayout}

`reduceGroupLayout` is declared at `src/2_graph/15_groupLayout.ts:22`.

Caller-owned state, suitable for a signal or event-log fold. Manual move means one completed
gesture and supplies the affected group's full local arrangement. Other groups remain unchanged.
Collapse permits automatic placement of the collapsed representation. Expansion uses the current
toggle; neither toggle branch deletes the saved manual arrangement. Identity reconciliation,
layout execution, and undo cursor remain caller-owned.

```ts
reduceGroupLayout: (state: GroupLayoutState, event: GroupLayoutEvent) => GroupLayoutState
```

### `groupAllowsAutoLayout` {#src-2-graph-15-grouplayout-ts-groupallowsautolayout}

`groupAllowsAutoLayout` is declared at `src/2_graph/15_groupLayout.ts:34`.

Whether the group's current representation may be laid out automatically. Unknown groups start automatic.

```ts
groupAllowsAutoLayout: (state: GroupLayoutState, groupId: string) => boolean
```

### `groupPositionsOf` {#src-2-graph-15-grouplayout-ts-grouppositionsof}

`groupPositionsOf` is declared at `src/2_graph/15_groupLayout.ts:40`.

Resolve local child positions after the caller has obtained an automatic arrangement.

```ts
groupPositionsOf: (state: GroupLayoutState, groupId: string, automatic: Readonly<Record<string, GraphPoint>>) => Readonly<Record<string, GraphPoint>>
```

## src/2_graph/16_neighborhood.ts

| export | kind |
| --- | --- |
| [`HoverMode`](#src-2-graph-16-neighborhood-ts-hovermode) | type |
| [`HoverOptions`](#src-2-graph-16-neighborhood-ts-hoveroptions) | type |
| [`graphNeighborhood`](#src-2-graph-16-neighborhood-ts-graphneighborhood) | function |
| [`hoverOpacity`](#src-2-graph-16-neighborhood-ts-hoveropacity) | function |

### `HoverMode` {#src-2-graph-16-neighborhood-ts-hovermode}

`HoverMode` is declared at `src/2_graph/16_neighborhood.ts:3`.

```ts
export type HoverMode = "off" | "neighbors" | "upstream" | "downstream" | "both"
```

### `HoverOptions` {#src-2-graph-16-neighborhood-ts-hoveroptions}

`HoverOptions` is declared at `src/2_graph/16_neighborhood.ts:4`.

```ts
export type HoverOptions = { mode: HoverMode; depth: number }

export function graphNeighborhood(graph: Graph, focus: ReadonlySet<GraphId>, options: HoverOptions): Record<GraphId, number>
```

### `graphNeighborhood` {#src-2-graph-16-neighborhood-ts-graphneighborhood}

`graphNeighborhood` is declared at `src/2_graph/16_neighborhood.ts:10`.

Breadth-first traversal gives every branch the same distance; cycles retain shortest paths.
Edge focus starts at its endpoints. Group focus starts at descendant nodes. Ownership does
not consume a hop; traversing a message/edge consumes one. Source order is never rewritten.

```ts
graphNeighborhood: (graph: Readonly<Record<string, GraphItem<unknown, unknown>>>, focus: ReadonlySet<string>, options: HoverOptions) => Record<string, number>
```

### `hoverOpacity` {#src-2-graph-16-neighborhood-ts-hoveropacity}

`hoverOpacity` is declared at `src/2_graph/16_neighborhood.ts:50`.

Focus and first-hop neighbors share full intensity; subsequent hops fade geometrically.

```ts
hoverOpacity: (hop: number | undefined, active: boolean) => number
```

## src/2_graph/17_groupProjection.ts

| export | kind |
| --- | --- |
| [`groupGraphItems`](#src-2-graph-17-groupprojection-ts-groupgraphitems) | function |
| [`collapsedGraphIds`](#src-2-graph-17-groupprojection-ts-collapsedgraphids) | function |
| [`collapseGraphFrame`](#src-2-graph-17-groupprojection-ts-collapsegraphframe) | function |

### `groupGraphItems` {#src-2-graph-17-groupprojection-ts-groupgraphitems}

`groupGraphItems` is declared at `src/2_graph/17_groupProjection.ts:5`.

Add explicit containment without changing source IDs or source ordering.

```ts
groupGraphItems: (graph: Readonly<Record<string, GraphItem<unknown, unknown>>>, id: string, members: readonly string[], label: string, parentId?: string | undefined) => Readonly<Record<string, GraphItem<...>>>
```

### `collapsedGraphIds` {#src-2-graph-17-groupprojection-ts-collapsedgraphids}

`collapsedGraphIds` is declared at `src/2_graph/17_groupProjection.ts:21`.

Hidden descendants and internal/incident edges; the full source graph remains available.

```ts
collapsedGraphIds: (graph: Readonly<Record<string, GraphItem<unknown, unknown>>>, collapsed: ReadonlySet<string>) => Set<string>
```

### `collapseGraphFrame` {#src-2-graph-17-groupprojection-ts-collapsegraphframe}

`collapseGraphFrame` is declared at `src/2_graph/17_groupProjection.ts:37`.

Visibility projection is renderer-independent and never deletes source topology.

```ts
collapseGraphFrame: (frame: GraphFrame, collapsed: ReadonlySet<string>) => GraphFrame
```

## src/2_graph/18_sequenceCollapse.ts

| export | kind |
| --- | --- |
| [`collapseSequenceFrame`](#src-2-graph-18-sequencecollapse-ts-collapsesequenceframe) | function |

### `collapseSequenceFrame` {#src-2-graph-18-sequencecollapse-ts-collapsesequenceframe}

`collapseSequenceFrame` is declared at `src/2_graph/18_sequenceCollapse.ts:9`.

Compact collapsed sequence fragments in source coordinates, retaining one header row.
Both renderers consume the same projected SVG and geometry. The input artifact and its source
remain unchanged; expansion simply projects again from the original frame.

```ts
collapseSequenceFrame: (document: Document, frame: GraphFrame, collapsed: ReadonlySet<string>) => GraphFrame
```

## src/2_graph/19_sequenceNeighborhood.ts

| export | kind |
| --- | --- |
| [`sequenceNeighborhood`](#src-2-graph-19-sequenceneighborhood-ts-sequenceneighborhood) | function |

### `sequenceNeighborhood` {#src-2-graph-19-sequenceneighborhood-ts-sequenceneighborhood}

`sequenceNeighborhood` is declared at `src/2_graph/19_sequenceNeighborhood.ts:5`.

Traverse ordered message events, including fork/join branches, then paint their actor endpoints.

```ts
sequenceNeighborhood: (graph: Readonly<Record<string, GraphItem<SequenceGraphNodeData, SequenceGraphEdgeData>>>, focus: ReadonlySet<...>, options: HoverOptions) => Record<...>
```

## src/2_graph/20_groupActors.ts

| export | kind |
| --- | --- |
| [`groupSequenceActors`](#src-2-graph-20-groupactors-ts-groupsequenceactors) | function |

### `groupSequenceActors` {#src-2-graph-20-groupactors-ts-groupsequenceactors}

`groupSequenceActors` is declared at `src/2_graph/20_groupActors.ts:8`.

Group existing actor IDs without rewriting source text or message endpoints.
Adds a bound header to the sealed SVG so both adapters render the same authored view group.
Collapsing the group uses the shared containment visibility projection.

```ts
groupSequenceActors: (frame: GraphFrame, id: string, actors: readonly string[], label: string) => GraphFrame
```

## src/2_graph/0_frame.ts

Render a graph from explicit geometry, camera, and presentation state.

| export | kind |
| --- | --- |
| [`GraphGeometry`](#src-2-graph-0-frame-ts-graphgeometry) | type |
| [`GraphCamera`](#src-2-graph-0-frame-ts-graphcamera) | type |
| [`HeaderPlacement`](#src-2-graph-0-frame-ts-headerplacement) | type |
| [`GraphLabel`](#src-2-graph-0-frame-ts-graphlabel) | type |
| [`GraphPresentation`](#src-2-graph-0-frame-ts-graphpresentation) | type |
| [`GraphFrame`](#src-2-graph-0-frame-ts-graphframe) | type |

### `GraphGeometry` {#src-2-graph-0-frame-ts-graphgeometry}

`GraphGeometry` is declared at `src/2_graph/0_frame.ts:7`.

Geometry keyed by graph item ID. The revision identifies the captured layout; bounds and routes use world coordinates.

```ts
export type GraphGeometry = {
  revisionId: string
  boundsById: Readonly<Record<GraphId, Rect>>
  endpointAnchorById: Readonly<Record<GraphId, { x: number; y: number }>>
  routesById: Readonly<Record<GraphId, Float32Array>>
  headerBoundsById: Readonly<Record<GraphId, Rect>>
  // Sequence actors and any other item that owns a vertical column; a renderer pins their
  // headers in a screen-space row so a tall diagram stays readable while it scrolls.
  columnBoundsById?: Readonly<Record<GraphId, Rect>>
}
```

### `GraphCamera` {#src-2-graph-0-frame-ts-graphcamera}

`GraphCamera` is declared at `src/2_graph/0_frame.ts:19`.

Map world coordinates to screen pixels with world * scale + translation; the viewport defines the visible screen rectangle.

```ts
export type GraphCamera = {
  x: number
  y: number
  scale: number
  viewport: Rect
}
```

### `HeaderPlacement` {#src-2-graph-0-frame-ts-headerplacement}

`HeaderPlacement` is declared at `src/2_graph/0_frame.ts:26`.

```ts
export type HeaderPlacement = {
  id: GraphId
  depth: number
  top: number
  visible: boolean
  state: "natural" | "stuck" | "released"
}
```

### `GraphLabel` {#src-2-graph-0-frame-ts-graphlabel}

`GraphLabel` is declared at `src/2_graph/0_frame.ts:34`.

```ts
export type GraphLabel = {
  text: string
}
```

### `GraphPresentation` {#src-2-graph-0-frame-ts-graphpresentation}

`GraphPresentation` is declared at `src/2_graph/0_frame.ts:39`.

Presentation projected onto graph IDs: visibility, focus, labels, sticky layers, and optional manual translations.

```ts
export type GraphPresentation = {
  stickyHeaders: readonly HeaderPlacement[]
  hiddenIds: ReadonlySet<GraphId>
  focusedIds: ReadonlySet<GraphId>
  /** Hover distance by logical graph ID; missing IDs are faded context while nonempty. */
  hopsById?: Readonly<Record<GraphId, number>>
  labelsById: Readonly<Record<GraphId, GraphLabel>>
  sealedSvgArtifactsByRootId: SealedSvgArtifactsByRootId
  translationsById?: Readonly<Record<GraphId, { x: number; y: number }>>
  resolvedPortsById?: Readonly<Record<GraphId, ResolvedPortLocation>>
}
```

### `GraphFrame` {#src-2-graph-0-frame-ts-graphframe}

`GraphFrame` is declared at `src/2_graph/0_frame.ts:52`.

A complete render input combining the graph with its geometry, camera, and presentation. The caller owns state and lifetime.

```ts
export type GraphFrame<NodeData = unknown, EdgeData = unknown> = {
  graph: Graph<NodeData, EdgeData>
  geometry: GraphGeometry
  camera: GraphCamera
  presentation: GraphPresentation
}
```

## src/2_graph/1_fitCamera.ts

| export | kind |
| --- | --- |
| [`fitGraphCamera`](#src-2-graph-1-fitcamera-ts-fitgraphcamera) | function |

### `fitGraphCamera` {#src-2-graph-1-fitcamera-ts-fitgraphcamera}

`fitGraphCamera` is declared at `src/2_graph/1_fitCamera.ts:41`.

Fits all declared graph geometry into a viewport using a screen-space padding.

```ts
fitGraphCamera: (geometry: GraphGeometry, viewport: Rect, padding: number) => GraphCamera
```

## src/2_graph/2_geometryScope.ts

| export | kind |
| --- | --- |
| [`SealedGeometryFit`](#src-2-graph-2-geometryscope-ts-sealedgeometryfit) | type |
| [`SealedGeometryScope`](#src-2-graph-2-geometryscope-ts-sealedgeometryscope) | type |
| [`SealedGeometryTransform`](#src-2-graph-2-geometryscope-ts-sealedgeometrytransform) | type |
| [`sealedGeometryTransformOf`](#src-2-graph-2-geometryscope-ts-sealedgeometrytransformof) | function |
| [`composeGraphGeometryScopes`](#src-2-graph-2-geometryscope-ts-composegraphgeometryscopes) | function |

### `SealedGeometryFit` {#src-2-graph-2-geometryscope-ts-sealedgeometryfit}

`SealedGeometryFit` is declared at `src/2_graph/2_geometryScope.ts:5`.

```ts
export type SealedGeometryFit = "contain"

export function sealedGeometryTransformOf(source: Rect, target: Rect, fit: SealedGeometryFit): SealedGeometryTransform
```

### `SealedGeometryScope` {#src-2-graph-2-geometryscope-ts-sealedgeometryscope}

`SealedGeometryScope` is declared at `src/2_graph/2_geometryScope.ts:7`.

```ts
export type SealedGeometryScope = {
  rootId: GraphId
  geometry: GraphGeometry
  fit: SealedGeometryFit
}

export function composeGraphGeometryScopes(outer: GraphGeometry, graph: Graph, scopes: readonly SealedGeometryScope[]): GraphGeometry
```

### `SealedGeometryTransform` {#src-2-graph-2-geometryscope-ts-sealedgeometrytransform}

`SealedGeometryTransform` is declared at `src/2_graph/2_geometryScope.ts:13`.

```ts
export type SealedGeometryTransform = {
  scaleX: number
  scaleY: number
  translateX: number
  translateY: number
}

export function sealedGeometryTransformOf(source: Rect, target: Rect, fit: SealedGeometryFit): SealedGeometryTransform
```

### `sealedGeometryTransformOf` {#src-2-graph-2-geometryscope-ts-sealedgeometrytransformof}

`sealedGeometryTransformOf` is declared at `src/2_graph/2_geometryScope.ts:26`.

```ts
sealedGeometryTransformOf: (source: Rect, target: Rect, fit: "contain") => SealedGeometryTransform
```

### `composeGraphGeometryScopes` {#src-2-graph-2-geometryscope-ts-composegraphgeometryscopes}

`composeGraphGeometryScopes` is declared at `src/2_graph/2_geometryScope.ts:115`.

Places native descendant geometry for sealed graph roots into outer-layout
coordinates. The source geometry remains unchanged and can be reused by its
native renderer.

```ts
composeGraphGeometryScopes: (outer: GraphGeometry, graph: Readonly<Record<string, GraphItem<unknown, unknown>>>, scopes: readonly SealedGeometryScope[]) => GraphGeometry
```

## src/2_graph/3_sealedSvgArtifact.ts

| export | kind |
| --- | --- |
| [`SealedSvgArtifact`](#src-2-graph-3-sealedsvgartifact-ts-sealedsvgartifact) | type |
| [`SealedSvgArtifactsByRootId`](#src-2-graph-3-sealedsvgartifact-ts-sealedsvgartifactsbyrootid) | type |
| [`EMPTY_SEALED_SVG_ARTIFACTS_BY_ROOT_ID`](#src-2-graph-3-sealedsvgartifact-ts-empty-sealed-svg-artifacts-by-root-id) | const |
| [`validateSealedSvgArtifacts`](#src-2-graph-3-sealedsvgartifact-ts-validatesealedsvgartifacts) | function |

### `SealedSvgArtifact` {#src-2-graph-3-sealedsvgartifact-ts-sealedsvgartifact}

`SealedSvgArtifact` is declared at `src/2_graph/3_sealedSvgArtifact.ts:4`.

```ts
export type SealedSvgArtifact = {
  rootId: GraphId
  revisionId: string
  geometryRevisionId: string
  svg: string
  source?: { language: "mermaid" | "d2"; text: string; locator: string }
  sourceBounds: Rect
  fit: "contain"
  graphIdByElementId?: Readonly<Record<string, GraphId>>
  bindings?: readonly {
    elementId: string
    graphId: GraphId
    role: SvgBindingRole
    ordinal: number
  }[]
}
```

### `SealedSvgArtifactsByRootId` {#src-2-graph-3-sealedsvgartifact-ts-sealedsvgartifactsbyrootid}

`SealedSvgArtifactsByRootId` is declared at `src/2_graph/3_sealedSvgArtifact.ts:21`.

```ts
export type SealedSvgArtifactsByRootId = Readonly<Record<GraphId, SealedSvgArtifact>>

export function validateSealedSvgArtifacts(graph: Graph, artifacts: SealedSvgArtifactsByRootId): SealedSvgArtifactsByRootId
```

### `EMPTY_SEALED_SVG_ARTIFACTS_BY_ROOT_ID` {#src-2-graph-3-sealedsvgartifact-ts-empty-sealed-svg-artifacts-by-root-id}

`EMPTY_SEALED_SVG_ARTIFACTS_BY_ROOT_ID` is declared at `src/2_graph/3_sealedSvgArtifact.ts:23`.

```ts
EMPTY_SEALED_SVG_ARTIFACTS_BY_ROOT_ID: Readonly<Record<string, SealedSvgArtifact>>
```

### `validateSealedSvgArtifacts` {#src-2-graph-3-sealedsvgartifact-ts-validatesealedsvgartifacts}

`validateSealedSvgArtifacts` is declared at `src/2_graph/3_sealedSvgArtifact.ts:30`.

Validates presentation artifacts while preserving their record identity.

```ts
validateSealedSvgArtifacts: (graph: Readonly<Record<string, GraphItem<unknown, unknown>>>, artifacts: Readonly<Record<string, SealedSvgArtifact>>) => Readonly<...>
```

## src/2_graph/4_svgGeometry.ts

| export | kind |
| --- | --- |
| [`SvgGraphPrimitive`](#src-2-graph-4-svggeometry-ts-svggraphprimitive) | type |
| [`svgGraphPrimitivesOf`](#src-2-graph-4-svggeometry-ts-svggraphprimitivesof) | function |
| [`svgGraphGeometryOf`](#src-2-graph-4-svggeometry-ts-svggraphgeometryof) | function |

### `SvgGraphPrimitive` {#src-2-graph-4-svggeometry-ts-svggraphprimitive}

`SvgGraphPrimitive` is declared at `src/2_graph/4_svgGeometry.ts:9`.

```ts
export type SvgGraphPrimitive = {
  elementId: string
  graphId: GraphId
  role: SvgBindingRole
  ordinal: number
  bounds: Rect
  route?: Float32Array
}

export function svgGraphPrimitivesOf(document: Document, artifact: SealedSvgArtifact): readonly SvgGraphPrimitive[]
```

### `svgGraphPrimitivesOf` {#src-2-graph-4-svggeometry-ts-svggraphprimitivesof}

`svgGraphPrimitivesOf` is declared at `src/2_graph/4_svgGeometry.ts:92`.

Measures each bound SVG element without collapsing repeated roles onto its graph item.

```ts
svgGraphPrimitivesOf: (document: Document, artifact: SealedSvgArtifact) => readonly SvgGraphPrimitive[]
```

### `svgGraphGeometryOf` {#src-2-graph-4-svggeometry-ts-svggraphgeometryof}

`svgGraphGeometryOf` is declared at `src/2_graph/4_svgGeometry.ts:121`.

Measures bound SVG elements into canonical Grapht geometry in SVG viewBox coordinates.

```ts
svgGraphGeometryOf: (document: Document, artifact: SealedSvgArtifact) => GraphGeometry
```

## src/2_graph/5_translateGeometry.ts

Apply caller-owned manual offsets to captured graph geometry.

| export | kind |
| --- | --- |
| [`GraphTranslations`](#src-2-graph-5-translategeometry-ts-graphtranslations) | type |
| [`translateGraphGeometry`](#src-2-graph-5-translategeometry-ts-translategraphgeometry) | function |

### `GraphTranslations` {#src-2-graph-5-translategeometry-ts-graphtranslations}

`GraphTranslations` is declared at `src/2_graph/5_translateGeometry.ts:5`.

```ts
export type GraphTranslations = Readonly<Record<GraphId, GraphPoint>>

export function translateGraphGeometry(graph: Graph, geometry: GraphGeometry, translations: GraphTranslations): GraphGeometry
```

### `translateGraphGeometry` {#src-2-graph-5-translategeometry-ts-translategraphgeometry}

`translateGraphGeometry` is declared at `src/2_graph/5_translateGeometry.ts:16`.

Return geometry with per-ID offsets applied to bounds, anchors, headers, and attached route endpoints.
The input remains unchanged. An empty or all-zero translation returns the same geometry object.
Group descendants require their own entries; this function does not create an undo journal or rerun layout.

```ts
translateGraphGeometry: (graph: Readonly<Record<string, GraphItem<unknown, unknown>>>, geometry: GraphGeometry, translations: Readonly<Record<string, GraphPoint>>) => GraphGeometry
```

## src/2_graph/6_stackGroupHeaders.ts

| export | kind |
| --- | --- |
| [`GroupHeader`](#src-2-graph-6-stackgroupheaders-ts-groupheader) | type |
| [`StackGroupHeadersInput`](#src-2-graph-6-stackgroupheaders-ts-stackgroupheadersinput) | type |
| [`stackGroupHeaders`](#src-2-graph-6-stackgroupheaders-ts-stackgroupheaders) | function |

### `GroupHeader` {#src-2-graph-6-stackgroupheaders-ts-groupheader}

`GroupHeader` is declared at `src/2_graph/6_stackGroupHeaders.ts:4`.

```ts
export type GroupHeader = {
  id: GraphId
  naturalTop: number
  boundaryBottom: number
  height: number
  order: number
}
```

### `StackGroupHeadersInput` {#src-2-graph-6-stackgroupheaders-ts-stackgroupheadersinput}

`StackGroupHeadersInput` is declared at `src/2_graph/6_stackGroupHeaders.ts:12`.

```ts
export type StackGroupHeadersInput = {
  graph: Graph
  headers: readonly GroupHeader[]
  camera: GraphCamera
  inset: number
  gap: number
}

export function stackGroupHeaders(input: StackGroupHeadersInput): readonly HeaderPlacement[]
```

### `stackGroupHeaders` {#src-2-graph-6-stackgroupheaders-ts-stackgroupheaders}

`stackGroupHeaders` is declared at `src/2_graph/6_stackGroupHeaders.ts:34`.

```ts
stackGroupHeaders: (input: StackGroupHeadersInput) => readonly HeaderPlacement[]
```

## src/2_graph/9_operators.ts

| export | kind |
| --- | --- |
| [`ingest`](#src-2-graph-9-operators-ts-ingest) | function |
| [`layout`](#src-2-graph-9-operators-ts-layout) | function |
| [`groupHeadersOf`](#src-2-graph-9-operators-ts-groupheadersof) | function |
| [`graphLabelsOf`](#src-2-graph-9-operators-ts-graphlabelsof) | function |
| [`present`](#src-2-graph-9-operators-ts-present) | function |

### `ingest` {#src-2-graph-9-operators-ts-ingest}

`ingest` is declared at `src/2_graph/9_operators.ts:43`.

```ts
ingest: <Source, NodeData, EdgeData>(lower: GraphWork<Source, Readonly<Record<string, GraphItem<NodeData, EdgeData>>>>) => Ingest<Source, NodeData, EdgeData>
```

### `layout` {#src-2-graph-9-operators-ts-layout}

`layout` is declared at `src/2_graph/9_operators.ts:49`.

```ts
layout: <NodeData, EdgeData>(measure: GraphWork<Readonly<Record<string, GraphItem<NodeData, EdgeData>>>, GraphGeometry>) => Layout<...>
```

### `groupHeadersOf` {#src-2-graph-9-operators-ts-groupheadersof}

`groupHeadersOf` is declared at `src/2_graph/9_operators.ts:55`.

```ts
groupHeadersOf: (geometry: GraphGeometry) => GroupHeader[]
```

### `graphLabelsOf` {#src-2-graph-9-operators-ts-graphlabelsof}

`graphLabelsOf` is declared at `src/2_graph/9_operators.ts:79`.

```ts
graphLabelsOf: (graph: Readonly<Record<string, GraphItem<unknown, unknown>>>) => Readonly<Record<string, GraphLabel>>
```

### `present` {#src-2-graph-9-operators-ts-present}

`present` is declared at `src/2_graph/9_operators.ts:87`.

```ts
present: <NodeData, EdgeData>(input: { camera$: Observable<GraphCamera>; focusIds$: Observable<ReadonlySet<string>>; selectionIds$: Observable<ReadonlySet<string>>; sealedSvgArtifactsByRootId$?: Observable<...> | undefined; translationsById$?: Observable<...> | undefined; inset?: number | undefined; gap?: number | undefined;...
```

## src/2_graph/10_renderer.ts

Project graph frames through one renderer resource for each stream lifetime.

| export | kind |
| --- | --- |
| [`GraphRenderReceipt`](#src-2-graph-10-renderer-ts-graphrenderreceipt) | type |
| [`GraphFrameResource`](#src-2-graph-10-renderer-ts-graphframeresource) | type |
| [`graphRenderReceipt`](#src-2-graph-10-renderer-ts-graphrenderreceipt-2) | function |
| [`graphRenderer`](#src-2-graph-10-renderer-ts-graphrenderer) | function |

### `GraphRenderReceipt` {#src-2-graph-10-renderer-ts-graphrenderreceipt}

`GraphRenderReceipt` is declared at `src/2_graph/10_renderer.ts:8`.

ID membership changes between frames; update IDs include every retained item, regardless of content equality.

```ts
export type GraphRenderReceipt = {
  enterIds: readonly GraphId[]
  updateIds: readonly GraphId[]
  exitIds: readonly GraphId[]
}

export function graphRenderReceipt(previousIds: ReadonlySet<GraphId>, frame: GraphFrame): GraphRenderReceipt
```

### `GraphFrameResource` {#src-2-graph-10-renderer-ts-graphframeresource}

`GraphFrameResource` is declared at `src/2_graph/10_renderer.ts:15`.

A renderer-owned resource that accepts frames and releases its listeners and elements through unsubscribe.

```ts
export type GraphFrameResource<NodeData = unknown, EdgeData = unknown> = {
  render(frame: GraphFrame<NodeData, EdgeData>, receipt: GraphRenderReceipt): void
  /** Paint hover without replacing geometry, changing the camera, or cancelling momentum. */
  applyHover?(hopsById: Readonly<Record<GraphId, number>>): void
  unsubscribe(): void
}
```

### `graphRenderReceipt` {#src-2-graph-10-renderer-ts-graphrenderreceipt-2}

`graphRenderReceipt` is declared at `src/2_graph/10_renderer.ts:27`.

Compare current graph IDs with the prior set and return sorted enter, update, and exit lists.

```ts
graphRenderReceipt: (previousIds: ReadonlySet<string>, frame: GraphFrame) => GraphRenderReceipt
```

### `graphRenderer` {#src-2-graph-10-renderer-ts-graphrenderer}

`graphRenderer` is declared at `src/2_graph/10_renderer.ts:41`.

Return a renderer operator that acquires its resource when the caller activates the stream.
Each frame carries an ID receipt; completion, error, or unsubscription releases the resource.
The returned stream leaves activation and cancellation at the caller's boundary.

```ts
graphRenderer: <NodeData = unknown, EdgeData = unknown>(acquire: (host: HTMLElement) => GraphFrameResource<NodeData, EdgeData>) => GraphRenderer<NodeData, EdgeData>
```

## src/2_graph/13_foreignObjectText.ts

d2 renders markdown labels as foreignObject HTML, which the sanitizers remove; each block becomes width-measured svg text instead.

| export | kind |
| --- | --- |
| [`foreignObjectsToText`](#src-2-graph-13-foreignobjecttext-ts-foreignobjectstotext) | function |

### `foreignObjectsToText` {#src-2-graph-13-foreignobjecttext-ts-foreignobjectstotext}

`foreignObjectsToText` is declared at `src/2_graph/13_foreignObjectText.ts:3`.

```ts
foreignObjectsToText: (source: string, startFontSize?: number) => string
```

## src/5_history/0_journal.ts

| export | kind |
| --- | --- |
| [`HistoryRevision`](#src-5-history-0-journal-ts-historyrevision) | type |
| [`HistoryJournal`](#src-5-history-0-journal-ts-historyjournal) | type |
| [`contentHashOf`](#src-5-history-0-journal-ts-contenthashof) | function |
| [`journalToJsonl`](#src-5-history-0-journal-ts-journaltojsonl) | function |
| [`jsonlToJournal`](#src-5-history-0-journal-ts-jsonltojournal) | function |
| [`journalAnomalies`](#src-5-history-0-journal-ts-journalanomalies) | function |

### `HistoryRevision` {#src-5-history-0-journal-ts-historyrevision}

`HistoryRevision` is declared at `src/5_history/0_journal.ts:5`.

```ts
export type HistoryRevision = {
  artifactId: string
  revisionId: string
  parentRevisionIds: readonly string[]
  /** sha256 of `content`, so consumers verify what they read. */
  contentHash: string
  /** Commit timestamp in ISO 8601, from the ingest, not from reading time. */
  capturedAt: string
  message: string
  path: string
  content: string
}
```

### `HistoryJournal` {#src-5-history-0-journal-ts-historyjournal}

`HistoryJournal` is declared at `src/5_history/0_journal.ts:18`.

```ts
export type HistoryJournal = {
  format: "grapht-history/0"
  artifactId: string
  path: string
  /** Oldest first, so parents always precede children. */
  revisions: readonly HistoryRevision[]
}

export function journalToJsonl(journal: HistoryJournal): string
```

### `contentHashOf` {#src-5-history-0-journal-ts-contenthashof}

`contentHashOf` is declared at `src/5_history/0_journal.ts:26`.

```ts
contentHashOf: (content: string) => string
```

### `journalToJsonl` {#src-5-history-0-journal-ts-journaltojsonl}

`journalToJsonl` is declared at `src/5_history/0_journal.ts:31`.

Serializes the journal as JSON Lines, one revision per line under a header line.

```ts
journalToJsonl: (journal: HistoryJournal) => string
```

### `jsonlToJournal` {#src-5-history-0-journal-ts-jsonltojournal}

`jsonlToJournal` is declared at `src/5_history/0_journal.ts:40`.

```ts
jsonlToJournal: (text: string) => HistoryJournal
```

### `journalAnomalies` {#src-5-history-0-journal-ts-journalanomalies}

`journalAnomalies` is declared at `src/5_history/0_journal.ts:55`.

Names structural defects: duplicate revisions and out-of-order capture times.

```ts
journalAnomalies: (journal: HistoryJournal) => readonly string[]
```

## src/5_history/1_gitWalk.ts

| export | kind |
| --- | --- |
| [`gitHistoryJournal`](#src-5-history-1-gitwalk-ts-githistoryjournal) | function |

### `gitHistoryJournal` {#src-5-history-1-gitwalk-ts-githistoryjournal}

`gitHistoryJournal` is declared at `src/5_history/1_gitWalk.ts:18`.

```ts
gitHistoryJournal: (workingDirectory: string, path: string, artifactId?: string) => Promise<HistoryJournal>
```

## src/5_history/2_cli.ts

| export | kind |
| --- | --- |
| [`historyMain`](#src-5-history-2-cli-ts-historymain) | function |

### `historyMain` {#src-5-history-2-cli-ts-historymain}

`historyMain` is declared at `src/5_history/2_cli.ts:7`.

```ts
historyMain: (argv: readonly string[]) => Promise<number>
```

