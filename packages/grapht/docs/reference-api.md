# Every export

The public surface of `@hafley66/grapht` that the pages above this one describe: the graph frame, the sticky headers, the renderer contract, and the history journal. The bench protocol and renderer contracts are omitted, because a page here does not answer a question about them yet.

Read out of the TypeScript program by `packages/docs-kit/scripts/api.mjs`: the barrel names what is public, each module answers for what it declares, and the checker answers for every signature. Editing this file by hand is editing the thing that overwrites it.

## Modules

| module | exports | what it is |
| --- | --- | --- |
| [src/2_graph/0_frame.ts](#src-2-graph-0-frame-ts) | 6 |  |
| [src/2_graph/1_fitCamera.ts](#src-2-graph-1-fitcamera-ts) | 1 |  |
| [src/2_graph/2_geometryScope.ts](#src-2-graph-2-geometryscope-ts) | 5 |  |
| [src/2_graph/3_sealedSvgArtifact.ts](#src-2-graph-3-sealedsvgartifact-ts) | 4 |  |
| [src/2_graph/4_svgGeometry.ts](#src-2-graph-4-svggeometry-ts) | 3 |  |
| [src/2_graph/5_translateGeometry.ts](#src-2-graph-5-translategeometry-ts) | 2 |  |
| [src/2_graph/6_stackGroupHeaders.ts](#src-2-graph-6-stackgroupheaders-ts) | 3 |  |
| [src/2_graph/9_operators.ts](#src-2-graph-9-operators-ts) | 5 |  |
| [src/2_graph/10_renderer.ts](#src-2-graph-10-renderer-ts) | 4 |  |
| [src/2_graph/13_foreignObjectText.ts](#src-2-graph-13-foreignobjecttext-ts) | 1 | d2 renders markdown labels as foreignObject HTML, which the sanitizers remove; each block becomes width-measured svg text instead. |
| [src/5_history/0_journal.ts](#src-5-history-0-journal-ts) | 6 |  |
| [src/5_history/1_gitWalk.ts](#src-5-history-1-gitwalk-ts) | 1 |  |
| [src/5_history/2_cli.ts](#src-5-history-2-cli-ts) | 1 |  |

## src/2_graph/0_frame.ts

| export | kind |
| --- | --- |
| [`GraphGeometry`](#src-2-graph-0-frame-ts-graphgeometry) | type |
| [`GraphCamera`](#src-2-graph-0-frame-ts-graphcamera) | type |
| [`HeaderPlacement`](#src-2-graph-0-frame-ts-headerplacement) | type |
| [`GraphLabel`](#src-2-graph-0-frame-ts-graphlabel) | type |
| [`GraphPresentation`](#src-2-graph-0-frame-ts-graphpresentation) | type |
| [`GraphFrame`](#src-2-graph-0-frame-ts-graphframe) | type |

### `GraphGeometry` {#src-2-graph-0-frame-ts-graphgeometry}

`GraphGeometry` is declared at `src/2_graph/0_frame.ts:5`.

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

`GraphCamera` is declared at `src/2_graph/0_frame.ts:16`.

```ts
export type GraphCamera = {
  x: number
  y: number
  scale: number
  viewport: Rect
}
```

### `HeaderPlacement` {#src-2-graph-0-frame-ts-headerplacement}

`HeaderPlacement` is declared at `src/2_graph/0_frame.ts:23`.

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

`GraphLabel` is declared at `src/2_graph/0_frame.ts:31`.

```ts
export type GraphLabel = {
  text: string
}
```

### `GraphPresentation` {#src-2-graph-0-frame-ts-graphpresentation}

`GraphPresentation` is declared at `src/2_graph/0_frame.ts:35`.

```ts
export type GraphPresentation = {
  stickyHeaders: readonly HeaderPlacement[]
  hiddenIds: ReadonlySet<GraphId>
  focusedIds: ReadonlySet<GraphId>
  labelsById: Readonly<Record<GraphId, GraphLabel>>
  sealedSvgArtifactsByRootId: SealedSvgArtifactsByRootId
  translationsById?: Readonly<Record<GraphId, { x: number; y: number }>>
  resolvedPortsById?: Readonly<Record<GraphId, ResolvedPortLocation>>
}
```

### `GraphFrame` {#src-2-graph-0-frame-ts-graphframe}

`GraphFrame` is declared at `src/2_graph/0_frame.ts:45`.

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

`SealedSvgArtifactsByRootId` is declared at `src/2_graph/3_sealedSvgArtifact.ts:20`.

```ts
export type SealedSvgArtifactsByRootId = Readonly<Record<GraphId, SealedSvgArtifact>>

export function validateSealedSvgArtifacts(graph: Graph, artifacts: SealedSvgArtifactsByRootId): SealedSvgArtifactsByRootId
```

### `EMPTY_SEALED_SVG_ARTIFACTS_BY_ROOT_ID` {#src-2-graph-3-sealedsvgartifact-ts-empty-sealed-svg-artifacts-by-root-id}

`EMPTY_SEALED_SVG_ARTIFACTS_BY_ROOT_ID` is declared at `src/2_graph/3_sealedSvgArtifact.ts:22`.

```ts
EMPTY_SEALED_SVG_ARTIFACTS_BY_ROOT_ID: Readonly<Record<string, SealedSvgArtifact>>
```

### `validateSealedSvgArtifacts` {#src-2-graph-3-sealedsvgartifact-ts-validatesealedsvgartifacts}

`validateSealedSvgArtifacts` is declared at `src/2_graph/3_sealedSvgArtifact.ts:29`.

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

| export | kind |
| --- | --- |
| [`GraphTranslations`](#src-2-graph-5-translategeometry-ts-graphtranslations) | type |
| [`translateGraphGeometry`](#src-2-graph-5-translategeometry-ts-translategraphgeometry) | function |

### `GraphTranslations` {#src-2-graph-5-translategeometry-ts-graphtranslations}

`GraphTranslations` is declared at `src/2_graph/5_translateGeometry.ts:4`.

```ts
export type GraphTranslations = Readonly<Record<GraphId, GraphPoint>>

export function translateGraphGeometry(graph: Graph, geometry: GraphGeometry, translations: GraphTranslations): GraphGeometry
```

### `translateGraphGeometry` {#src-2-graph-5-translategeometry-ts-translategraphgeometry}

`translateGraphGeometry` is declared at `src/2_graph/5_translateGeometry.ts:10`.

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

| export | kind |
| --- | --- |
| [`GraphRenderReceipt`](#src-2-graph-10-renderer-ts-graphrenderreceipt) | type |
| [`GraphFrameResource`](#src-2-graph-10-renderer-ts-graphframeresource) | type |
| [`graphRenderReceipt`](#src-2-graph-10-renderer-ts-graphrenderreceipt-2) | function |
| [`graphRenderer`](#src-2-graph-10-renderer-ts-graphrenderer) | function |

### `GraphRenderReceipt` {#src-2-graph-10-renderer-ts-graphrenderreceipt}

`GraphRenderReceipt` is declared at `src/2_graph/10_renderer.ts:6`.

```ts
export type GraphRenderReceipt = {
  enterIds: readonly GraphId[]
  updateIds: readonly GraphId[]
  exitIds: readonly GraphId[]
}

export function graphRenderReceipt(previousIds: ReadonlySet<GraphId>, frame: GraphFrame): GraphRenderReceipt
```

### `GraphFrameResource` {#src-2-graph-10-renderer-ts-graphframeresource}

`GraphFrameResource` is declared at `src/2_graph/10_renderer.ts:12`.

```ts
export type GraphFrameResource<NodeData = unknown, EdgeData = unknown> = {
  render(frame: GraphFrame<NodeData, EdgeData>, receipt: GraphRenderReceipt): void
  unsubscribe(): void
}
```

### `graphRenderReceipt` {#src-2-graph-10-renderer-ts-graphrenderreceipt-2}

`graphRenderReceipt` is declared at `src/2_graph/10_renderer.ts:21`.

```ts
graphRenderReceipt: (previousIds: ReadonlySet<string>, frame: GraphFrame) => GraphRenderReceipt
```

### `graphRenderer` {#src-2-graph-10-renderer-ts-graphrenderer}

`graphRenderer` is declared at `src/2_graph/10_renderer.ts:30`.

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

