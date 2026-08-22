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
  INITIAL_BENCH_SCENARIOS,
  INITIAL_BENCH_SCENARIO_CASES,
  reduceBenchScenarioCases,
} from "./11_scenarios.js"

export { directoryBytes, hashFile, hashFileIfExists, sha256Hex } from "./3_hash.js"
export type { ProcessResult } from "./4_process.js"
export { measureCommand } from "./4_process.js"

export type {
  BoardPlacement,
  BoardRevision,
  EntityGeometry,
  EntityId,
  GeometrySnapshot,
  GraphEntity,
  GraphLanguage,
  GraphRelation,
  GraphTopology,
  LayoutInput,
  LayoutOutput,
  RenderedArtifact,
  RenderOptions,
  RenderRevision,
  ReconciliationResult,
  SequenceCollapseState,
  SequenceFocus,
  SourceRevision,
  SvgBinding,
} from "@hafley66/grapht-model"
