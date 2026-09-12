export type {
  BenchError,
  BenchInput,
  BenchOperation,
  BenchOutput,
  BenchResult,
  BenchSample,
  BenchScenario,
  BenchScenarioArguments,
  BenchScenarioCases,
  BenchScenarioEvent,
  BenchScenarioHandler,
  BenchScenarioHandlers,
  BenchScenarioResult,
  JsonlEntry,
  OutputAnalysis,
  OutputIssue,
  OutputRecord,
  Terminal,
} from "./0_bench/0_protocol.js"
export {
  analyzeOutput,
  BENCH_PROTOCOL,
  benchErrorSchema,
  benchInputSchema,
  benchOperationSchema,
  benchOutputSchema,
  benchResultSchema,
  benchSampleSchema,
  GEOMETRY_PROTOCOL,
  parseBenchInput,
  parseJsonl,
  reduceBenchScenario,
} from "./0_bench/0_protocol.js"
export type { Geometry, GeometryManifest } from "./0_bench/1_geometryProtocol.js"
export {
  geometryManifestSchema,
  geometryOf,
  parseGeometryManifest,
  writeGeometry,
} from "./0_bench/1_geometryProtocol.js"
export type { FixtureDef, GridFixtureDef, Topology } from "./0_bench/2_fixtures.js"
export { fixturesDir, gridTopology, packageRoot } from "./0_bench/2_fixtures.js"
export type { RendererFixture } from "./0_bench/10_rendererFixture.js"
export { RENDER_FIXTURE_PROTOCOL, rendererFixtureNodeSchema, rendererFixtureSchema } from "./0_bench/10_rendererFixture.js"
export type { InitialBenchScenario, ScenarioRunReceipt, ScenarioSample } from "./0_bench/11_scenarios.js"
export {
  BENCH_SCENARIO_CASES,
  INITIAL_BENCH_SCENARIO_CASES,
  INITIAL_BENCH_SCENARIOS,
  reduceBenchScenarioCases,
} from "./0_bench/11_scenarios.js"
export type {
  IdentityAmbiguity,
  IdentityReceipt,
  PlacementSafetyReceipt,
  RelationDiagnostic,
  RelationValidation,
  SequenceOccurrence,
  SequenceOccurrenceDocument,
  SequenceOccurrenceKind,
  SequenceRelation,
  SequenceSourceSpan,
} from "./1_sequence/0_identity.js"
export {
  documentFingerprint,
  matchSequenceRevisions,
  occurrenceId,
  validateSequenceRelations,
} from "./1_sequence/0_identity.js"
export type {
  NativeRenderReceipt,
  NativeSvgElement,
  SvgBinding,
  SvgBindingReceipt,
  SvgBindingRole,
} from "./1_sequence/1_svgBinding.js"
export {
  decorateSvg,
  svgDescendantsOf,
  elementIdForBinding,
  parentPath,
  pathKey,
  SvgBindingBuilder,
} from "./1_sequence/1_svgBinding.js"
export type {
  SequenceArtifact,
  SequenceArtifactBuild,
  SequenceBindingRevision,
  SequenceRenderOptions,
  SequenceRenderRevision,
  SequenceSourceAdapter,
  SequenceSourceRevision,
} from "./1_sequence/2_artifact.js"
export {
  buildSequenceArtifact,
  SEQUENCE_ARTIFACT_PROTOCOL,
  sequenceArtifactSchema,
} from "./1_sequence/2_artifact.js"
export type { EntityGeometry, GeometryDiagnostic, Matrix2D, Rect, SequenceGeometry } from "./1_sequence/3_geometry.js"
export { measureSequenceSvg } from "./1_sequence/3_geometry.js"
export type { SequenceFocus } from "./1_sequence/4_focus.js"
export { resolveSequenceFocus } from "./1_sequence/4_focus.js"
export type { SequenceCollapseState } from "./1_sequence/5_collapse.js"
export { projectCollapsedSequence } from "./1_sequence/5_collapse.js"
export type { PlacementBlockReason, PlacementReconciliation, SequencePlacement } from "./1_sequence/6_placement.js"
export { reconcileSequencePlacements } from "./1_sequence/6_placement.js"

export type { GraphCamera, GraphFrame, GraphGeometry, GraphLabel, GraphPresentation, HeaderPlacement } from "./2_graph/0_frame.js"
export { fitGraphCamera } from "./2_graph/1_fitCamera.js"
export type { SealedGeometryFit, SealedGeometryScope, SealedGeometryTransform } from "./2_graph/2_geometryScope.js"
export { composeGraphGeometryScopes, sealedGeometryTransformOf } from "./2_graph/2_geometryScope.js"
export type { SealedSvgArtifact, SealedSvgArtifactsByRootId } from "./2_graph/3_sealedSvgArtifact.js"
export { EMPTY_SEALED_SVG_ARTIFACTS_BY_ROOT_ID, validateSealedSvgArtifacts } from "./2_graph/3_sealedSvgArtifact.js"
export type { SvgGraphPrimitive } from "./2_graph/4_svgGeometry.js"
export { svgGraphGeometryOf, svgGraphPrimitivesOf } from "./2_graph/4_svgGeometry.js"
export type { GraphTranslations } from "./2_graph/5_translateGeometry.js"
export { translateGraphGeometry } from "./2_graph/5_translateGeometry.js"
export type { GroupHeader, StackGroupHeadersInput } from "./2_graph/6_stackGroupHeaders.js"
export { stackGroupHeaders } from "./2_graph/6_stackGroupHeaders.js"
export type {
  GraphRenderer,
  Ingest,
  Layout,
  Present,
  RendererInteractions,
} from "./2_graph/7_operatorTypes.js"
export type { FilesystemEntry, FilesystemGraph, FilesystemNodeData } from "./2_graph/8_filesystemGraph.js"
export { filesystemGraph } from "./2_graph/8_filesystemGraph.js"
export { graphLabelsOf, groupHeadersOf, ingest, layout, present } from "./2_graph/9_operators.js"
export { fcoseGraphLayout } from "./2_graph/12_layout.js"
export type { GraphFrameResource, GraphRenderReceipt } from "./2_graph/10_renderer.js"
export { graphRenderer, graphRenderReceipt } from "./2_graph/10_renderer.js"
export type {
  GraphHierarchy,
  GraphologyDocument,
  GraphologyEdgeAttributes,
  GraphologyEdgeKey,
  GraphologyEdgeMapping,
  GraphologyGraphAttributes,
  GraphologyIdentity,
  GraphologyImportReceipt,
  GraphologyMutation,
  GraphologyNodeAttributes,
  GraphologyNodeKey,
  GraphologyTopology,
  SerializedGraphologyDocument,
} from "./3_contracts/0_graphology.js"
export type {
  graphologyDocumentOf,
  graphologyMutations,
  graphtGraphOf,
  parseGraphologyDocument,
  serializeGraphologyDocument,
} from "./3_contracts/0_graphology.js"
export type {
  CanonicalRendererState,
  GraphvizTertiaryContract,
  ReactFlowCompatibility,
  RendererCapability,
  RendererCapabilityContract,
  RendererCapabilityReceipt,
  RendererCapabilitySupport,
  RendererCompatibility,
  RendererDelivery,
  RendererFallbackAction,
  RendererKind,
  RendererOwnedState,
  RendererProjectionReceipt,
  YedCompatibility,
} from "./3_contracts/1_rendererCapabilities.js"
export type { rendererCapabilityContract, rendererCompatibility } from "./3_contracts/1_rendererCapabilities.js"
export type {
  GraphApplicationInput,
  GraphApplicationRootCardinality,
  GraphApplicationSignals,
  GraphFrameQueues,
  GraphInteraction,
  GraphInteractionState,
  GraphOperatorPolicy,
  GraphPaintQueueOptions,
  GraphRendererResource,
  GraphRendererResourceFactory,
  GraphRuntimeMetrics,
  GraphSelection,
  GraphViewport,
  MergeMapConcurrency,
  NativeRendererEventSource,
  RendererEventSignals,
  RendererUnsubscribeReceipt,
} from "./3_contracts/2_rendererRuntime.js"
export type {
  boundedMergeMap,
  domEventSignal,
  graphApplicationSignals,
  graphFrameQueues,
  graphInteractionState,
  mergeMapConcurrency,
  mountGraphApplication,
  reduceGraphInteraction,
  renderCytoscape,
  rendererEventSignals,
  rendererFrames,
  renderPixi,
  renderReact,
} from "./3_contracts/2_rendererRuntime.js"
export type {
  FivePortLocationExamples,
  GraphPortContract,
  GraphRendererHandleIdentity,
  GraphSemanticIdentity,
  GraphTopologyIdentity,
  GraphTranslatePlan,
  GraphVisualContract,
  GraphVisualFrame,
  GraphVisualId,
  GraphVisualIdentity,
  GraphVisualPartContract,
  GraphVisualPartId,
  GraphVisualPartIdentity,
  ResolvedGraphPort,
  ResolvedGraphVisual,
  ResolvedGraphVisualPart,
  SealedDiagramVisualContract,
  SequenceRootVisualContract,
  StickyGraphVisualInput,
  applyGraphTranslate,
  graphTranslatePlan,
  resolveGraphVisuals,
  stickyGraphVisualInputOf,
} from "./3_contracts/3_visualPort.js"

export type { ShakeCameraState, ShakeOffset } from "./0_bench/12_shake.js"
export { shakeOffsetAt, shakeOffsets } from "./0_bench/12_shake.js"

export type { PixelReadback, SampleRect, VisualValidity, VisualValidityInput } from "./0_bench/13_visualValidity.js"
export {
  BACKGROUND_DISTANCE_SQUARED,
  MINIMUM_NON_BACKGROUND_PIXELS,
  VISUAL_VALIDITY_BACKGROUND_COLOR,
  VISUAL_VALIDITY_VIEWPORT,
  backgroundOf,
  evaluateVisualValidity,
  sampleRectOf,
} from "./0_bench/13_visualValidity.js"

export { directoryBytes, hashFile, hashFileIfExists, sha256Hex } from "./0_bench/3_hash.js"
export type { ProcessResult } from "./0_bench/4_process.js"
export { measureCommand } from "./0_bench/4_process.js"
