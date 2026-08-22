export const GRAPH_MODEL_PROTOCOL = "grapht-model/0" as const

export type GraphLanguage = string
export type EntityId = string
export type RelationId = string
export type ArtifactId = string
export type RevisionId = string
export type ViewId = string

export type SourceSpan = {
  start: number
  end: number
  lineStart?: number
  lineEnd?: number
}

export type GraphEntityKind =
  | "actor"
  | "message"
  | "activation"
  | "group"
  | "note"
  | "node"
  | "edge"

export type GraphEntity = {
  id: EntityId
  kind: GraphEntityKind
  label?: string
  parentId?: EntityId
  sourceKey?: string
  ordinal: number
  sourceSpan?: SourceSpan
  metadata?: Readonly<Record<string, string>>
}

export type GraphRelationKind =
  | "message"
  | "edge"
  | "contains"
  | "activates"
  | "branch"

export type GraphRelation = {
  id: RelationId
  kind: GraphRelationKind
  sourceId: EntityId
  targetId: EntityId
  parentId?: EntityId
  ordinal: number
}

export type GraphTopology = {
  language: GraphLanguage
  entities: GraphEntity[]
  relations: GraphRelation[]
  sourceSpans: SourceSpan[]
}

export type SvgBindingRole = "shape" | "label" | "path" | "marker" | "lifeline" | "frame"

export type SvgBinding = {
  entityId: EntityId
  elementId: string
  role: SvgBindingRole
  ordinal: number
}

export type SourceRevision = {
  id: RevisionId
  artifactId: ArtifactId
  parentIds: RevisionId[]
  locator: string
  sourceHash: string
  adapterId: string
  identityVersion: string
}

export type RenderRevision = {
  id: RevisionId
  sourceRevisionId: RevisionId
  optionsHash: string
  rawSvg: string
  decoratedSvg: string
  bindings: SvgBinding[]
}

export type RenderedArtifact = {
  source: SourceRevision
  render: RenderRevision
  topology: GraphTopology
}

export type Point = { x: number; y: number }
export type Rect = { x: number; y: number; width: number; height: number }
export type Matrix2D = [number, number, number, number, number, number]

export type EntityGeometry = {
  entityId: EntityId
  localBounds: Rect
  worldBounds: Rect
  transform?: Matrix2D
  path?: Point[]
  sourceSvgElementIds: string[]
}

export type GeometrySnapshot = {
  id: RevisionId
  renderRevisionId: RevisionId
  coordinateSpace: "svg-viewBox"
  viewBox: Rect
  entities: EntityGeometry[]
}

export type BoardPlacement = {
  viewId: ViewId
  entityId: EntityId
  baseGeometryRevisionId: RevisionId
  rect: Rect
  source: "auto-layout" | "manual"
  policy: "absolute" | "delta-from-layout"
}

export type BoardRevision = {
  id: RevisionId
  graphRevisionId: RevisionId
  placements: BoardPlacement[]
  collapsedGroupIds: EntityId[]
}

export type ReconciliationResult = {
  retained: EntityId[]
  inserted: EntityId[]
  removed: EntityId[]
  ambiguous: EntityId[]
  placements: BoardPlacement[]
}

export type LayoutInput = {
  topology: GraphTopology
  previous?: GeometrySnapshot
}

export type LayoutOutput = {
  geometry: GeometrySnapshot
  implementation: string
}

export type RenderOptions = {
  dark: boolean
  signal?: AbortSignal
}

export type SequenceGroupKind =
  | "loop"
  | "alt"
  | "opt"
  | "par"
  | "critical"
  | "break"
  | "rect"
  | "box"
  | "d2-group"

export type SequenceFocus = {
  hoveredEntityId?: EntityId
  actorIds: EntityId[]
  groupIds: EntityId[]
}

export type SequenceCollapseState = {
  collapsedGroupIds: EntityId[]
}

export type ReconciliationInput = {
  previous?: BoardRevision
  next: {
    revisionId: RevisionId
    geometry: GeometrySnapshot
  }
}
