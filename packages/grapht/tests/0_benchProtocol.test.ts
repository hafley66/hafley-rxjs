import { describe, it, expect } from "vitest"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  BENCH_PROTOCOL,
  BENCH_SCENARIOS,
  benchInputSchema,
  benchOutputSchema,
  parseBenchInput,
  parseJsonl,
  analyzeOutput,
} from "../src/0_benchProtocol.js"
import { writeGeometry, parseGeometryManifest, geometryOf } from "../src/1_geometryProtocol.js"
import { gridTopology, loadFixtureDefs } from "../src/2_fixtures.js"

const validInput = {
  protocol: BENCH_PROTOCOL,
  runId: "run-1",
  fixture: "grid-1k",
  operation: "layout",
  input: JSON.stringify(gridTopology(2, 3, 1)),
  outputDirectory: "/tmp/out",
  parameters: { iterations: 3, depth: 0.5, debug: false },
}

describe("bench input schema", () => {
  it("keeps the renderer scenario vocabulary explicit", () => {
    expect(BENCH_SCENARIOS).toMatchInlineSnapshot(`
      [
        "camera-pan",
        "camera-wheel-zoom",
        "camera-pinch-zoom",
        "style-update",
        "position-update",
        "viewport-resize",
        "device-pixel-ratio-change",
        "group-collapse",
        "group-expand",
        "node-insert",
        "node-delete",
        "edge-insert",
        "edge-delete",
        "visibility-hide",
        "visibility-show",
        "layout-apply",
        "layout-run",
        "position-animation",
        "style-animation",
        "node-click",
        "box-select",
        "node-hover",
        "node-pick",
        "graph-load",
        "graph-clear",
        "graph-replace",
        "graph-dispose",
        "graph-reload",
        "labels-none",
        "labels-visible",
        "labels-fixed-count",
        "labels-dense",
      ]
    `)
  })

  it("accepts a well-formed BenchInput", () => {
    const parsed = benchInputSchema.parse(validInput)
    expect(parsed.runId).toBe("run-1")
    expect(parsed.operation).toBe("layout")
    expect(parsed.parameters.depth).toBe(0.5)
  })

  it("rejects a wrong protocol", () => {
    expect(() => benchInputSchema.parse({ ...validInput, protocol: "grapht-bench/1" })).toThrow()
  })

  it("rejects a missing runId", () => {
    const { runId: _drop, ...rest } = validInput
    expect(() => benchInputSchema.parse(rest)).toThrow()
  })

  it("rejects an unknown operation", () => {
    expect(() => benchInputSchema.parse({ ...validInput, operation: "draw" })).toThrow()
  })

  it("round-trips through parseBenchInput", () => {
    const text = JSON.stringify(validInput)
    expect(parseBenchInput(text)).toEqual(validInput)
  })

  it("rejects empty input", () => {
    expect(() => parseBenchInput("")).toThrow()
    expect(() => parseBenchInput("   ")).toThrow()
  })
})

describe("JSONL parsing", () => {
  const sample = {
    protocol: BENCH_PROTOCOL,
    type: "sample",
    runId: "run-1",
    phase: "layout",
    startedNs: 1,
    endedNs: 2,
    counters: { nodes: 10 },
  }
  const result = {
    protocol: BENCH_PROTOCOL,
    type: "result",
    runId: "run-1",
    implementation: "identity",
    operation: "layout",
    artifact: "a.json",
    counters: {},
  }

  it("parses valid lines and skips blanks", () => {
    const entries = parseJsonl(`${JSON.stringify(sample)}\n\n${JSON.stringify(result)}\n`, benchOutputSchema)
    expect(entries).toHaveLength(2)
    expect(entries.every((entry) => entry.ok)).toBe(true)
  })

  it("flags an invalid JSON line with its line number", () => {
    const entries = parseJsonl(`{"type": "sample"\n`, benchOutputSchema)
    expect(entries).toHaveLength(1)
    expect(entries[0].ok).toBe(false)
    if (!entries[0].ok) expect(entries[0].line).toBe(1)
  })

  it("flags a schema-invalid line", () => {
    const entries = parseJsonl(
      `${JSON.stringify({ protocol: BENCH_PROTOCOL, type: "nope" })}\n`,
      benchOutputSchema,
    )
    expect(entries[0].ok).toBe(false)
  })
})

describe("output analysis", () => {
  const sample = (runId: string) => ({
    protocol: BENCH_PROTOCOL,
    type: "sample",
    runId,
    phase: "p",
    startedNs: 1,
    endedNs: 2,
    counters: {},
  }) as const
  const result = (runId: string) => ({
    protocol: BENCH_PROTOCOL,
    type: "result",
    runId,
    implementation: "identity",
    operation: "layout",
    counters: {},
  }) as const
  const error = (runId: string) => ({
    protocol: BENCH_PROTOCOL,
    type: "error",
    runId,
    message: "boom",
  }) as const

  it("collects samples and finds the terminal result", () => {
    const analysis = analyzeOutput(
      [
        { line: 1, value: sample("r") as never },
        { line: 2, value: result("r") as never },
      ],
      "r",
    )
    expect(analysis.samples).toHaveLength(1)
    expect(analysis.terminal?.kind).toBe("result")
    expect(analysis.issues).toHaveLength(0)
  })

  it("flags a runId mismatch", () => {
    const analysis = analyzeOutput([{ line: 2, value: result("other") as never }], "r")
    expect(analysis.issues.length).toBeGreaterThan(0)
    expect(analysis.issues[0].message).toContain("runId mismatch")
    expect(analysis.terminal).toBeNull()
  })

  it("reports a missing terminal", () => {
    const analysis = analyzeOutput([{ line: 1, value: sample("r") as never }], "r")
    expect(analysis.terminal).toBeNull()
    expect(analysis.issues[0].message).toContain("no terminal")
  })

  it("detects a terminal BenchError", () => {
    const analysis = analyzeOutput([{ line: 1, value: error("r") as never }], "r")
    expect(analysis.terminal?.kind).toBe("error")
  })

  it("flags a duplicate terminal", () => {
    const analysis = analyzeOutput(
      [
        { line: 1, value: result("r") as never },
        { line: 2, value: result("r") as never },
      ],
      "r",
    )
    expect(analysis.issues.length).toBeGreaterThan(0)
    expect(analysis.issues[0].message).toContain("duplicate terminal")
  })
})

describe("grid geometry", () => {
  it("is deterministic", () => {
    expect(gridTopology(4, 4, 7)).toEqual(gridTopology(4, 4, 7))
  })

  it("computes grid node and edge counts", () => {
    const topology = gridTopology(2, 3, 1)
    expect(topology.nodeIds).toHaveLength(6)
    expect(topology.edges).toHaveLength(7)
    expect(topology.nodeIds[0]).toBe("n0_0")
  })

  it("writes a GeometryManifest with matching file counts", async () => {
    const dir = await mkdtemp(join(tmpdir(), "grapht-geom-"))
    try {
      const geometry = geometryOf(gridTopology(3, 3, 1))
      await writeGeometry(dir, geometry)
      const manifestText = await readFile(join(dir, "manifest.json"), "utf8")
      const parsed = parseGeometryManifest(manifestText)
      expect(parsed.nodeCount).toBe(9)
      expect(parsed.edgeCount).toBe(12)
      expect(geometry.positions).toHaveLength(18)
      const nodeIds = JSON.parse(await readFile(join(dir, parsed.nodeIds), "utf8")) as string[]
      expect(nodeIds).toHaveLength(9)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe("fixture definitions", () => {
  it("loads all checked-in fixtures", async () => {
    const defs = await loadFixtureDefs(import.meta.url)
    const ids = defs
      .map((def) => def.id)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    expect(ids).toEqual(["grid-1k", "grid-5k", "grid-10k"])
    const oneK = gridTopology(32, 32, 1)
    expect(oneK.nodeIds).toHaveLength(1024)
    expect(oneK.edges).toHaveLength(1984)
  })
})
