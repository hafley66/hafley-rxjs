export type {
  BenchError,
  BenchInput,
  BenchOperation,
  BenchOutput,
  BenchResult,
  BenchSample,
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

export { directoryBytes, hashFile, hashFileIfExists, sha256Hex } from "./3_hash.js"
export type { ProcessResult } from "./4_process.js"
export { measureCommand } from "./4_process.js"
