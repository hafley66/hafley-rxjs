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
} from "./0_benchProtocol.js"
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
} from "./0_benchProtocol.js"
export type { Geometry, GeometryManifest } from "./1_geometryProtocol.js"
export {
  geometryManifestSchema,
  geometryOf,
  parseGeometryManifest,
  writeGeometry,
} from "./1_geometryProtocol.js"
export type { FixtureDef, GridFixtureDef, Topology } from "./2_fixtures.js"
export { fixturesDir, gridTopology, packageRoot } from "./2_fixtures.js"
export type { RendererFixture } from "./10_rendererFixture.js"
export { RENDER_FIXTURE_PROTOCOL, rendererFixtureNodeSchema, rendererFixtureSchema } from "./10_rendererFixture.js"
export type { InitialBenchScenario, ScenarioRunReceipt, ScenarioSample } from "./11_scenarios.js"
export {
  BENCH_SCENARIO_CASES,
  INITIAL_BENCH_SCENARIO_CASES,
  INITIAL_BENCH_SCENARIOS,
  reduceBenchScenarioCases,
} from "./11_scenarios.js"
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
} from "./12_sequenceIdentity.js"
export {
  documentFingerprint,
  matchSequenceRevisions,
  occurrenceId,
  validateSequenceRelations,
} from "./12_sequenceIdentity.js"
export type {
  NativeRenderReceipt,
  NativeSvgElement,
  SvgBinding,
  SvgBindingReceipt,
  SvgBindingRole,
} from "./13_sequenceSvgBinding.js"
export {
  decorateSvg,
  descendantsOf,
  elementIdForBinding,
  parentPath,
  pathKey,
  SvgBindingBuilder,
} from "./13_sequenceSvgBinding.js"
export type {
  SequenceArtifact,
  SequenceArtifactBuild,
  SequenceArtifactCurrent,
  SequenceBindingRevision,
  SequenceRenderOptions,
  SequenceRenderRevision,
  SequenceSourceAdapter,
  SequenceSourceRevision,
} from "./14_sequenceArtifact.js"
export {
  buildSequenceArtifact,
  createSequenceArtifactCurrent,
  SEQUENCE_ARTIFACT_PROTOCOL,
  sequenceArtifactSchema,
} from "./14_sequenceArtifact.js"
export type { EntityGeometry, GeometryDiagnostic, Matrix2D, Rect, SequenceGeometry } from "./15_sequenceGeometry.js"
export { measureSequenceSvg } from "./15_sequenceGeometry.js"
export type { SequenceFocus } from "./16_sequenceFocus.js"
export { resolveSequenceFocus } from "./16_sequenceFocus.js"
export type { SequenceBoard, SequenceBoardInput, SequenceBoardReceipt, SequenceCamera } from "./17_sequenceBoard.js"
export { createSequenceBoard } from "./17_sequenceBoard.js"
export type { SequenceCollapseState } from "./18_sequenceCollapse.js"
export { projectCollapsedSequence } from "./18_sequenceCollapse.js"
export type { PlacementBlockReason, PlacementReconciliation, SequencePlacement } from "./19_sequencePlacement.js"
export { reconcileSequencePlacements } from "./19_sequencePlacement.js"

export type { ShakeCameraState, ShakeOffset } from "./12_shake.js"
export { shakeOffsetAt, shakeOffsets } from "./12_shake.js"

export type { PixelReadback, SampleRect, VisualValidity, VisualValidityInput } from "./13_visualValidity.js"
export {
  BACKGROUND_DISTANCE_SQUARED,
  MINIMUM_NON_BACKGROUND_PIXELS,
  VISUAL_VALIDITY_BACKGROUND_COLOR,
  VISUAL_VALIDITY_VIEWPORT,
  backgroundOf,
  evaluateVisualValidity,
  sampleRectOf,
} from "./13_visualValidity.js"

export { directoryBytes, hashFile, hashFileIfExists, sha256Hex } from "./3_hash.js"
export type { ProcessResult } from "./4_process.js"
export { measureCommand } from "./4_process.js"
