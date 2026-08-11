import { readFileSync } from "node:fs"
import { test, expect } from "vitest"
import { rendererFixtureMemory } from "../src/10_rendererFixture.js"

const sizeCases = [
  {
    size: "10k",
    nodeCount: 10_000,
    edgeCount: 19_800,
    bytes: { json: 549_305, jsObjects: 2_776_176, rustOwned: 844_577, packed: 278_400 },
  },
  {
    size: "100k",
    nodeCount: 100_000,
    edgeCount: 199_367,
    bytes: { json: 6_207_736, jsObjects: 22_355_704, rustOwned: 7_021_972, packed: 2_794_936 },
  },
  {
    size: "1m",
    nodeCount: 1_000_000,
    edgeCount: 1_998_000,
    bytes: { json: 67_085_012, jsObjects: 223_857_280, rustOwned: 58_111_795, packed: 27_984_000 },
  },
] as const

const storageTypes = [
  { storage: "JSON UTF-8", key: "json", receiptField: "jsonBytes" },
  { storage: "JavaScript objects", key: "jsObjects", receiptField: "jsParsedHeapDeltaBytes" },
  { storage: "Rust owned objects", key: "rustOwned", receiptField: "rustRetainedPayloadBytes" },
  { storage: "packed render buffers", key: "packed", receiptField: "packedRenderBytes" },
] as const

const cases = sizeCases.flatMap(sizeCase => storageTypes.map(storageType => ({
  name: `${sizeCase.size} × ${storageType.storage}`,
  nodeCount: sizeCase.nodeCount,
  edgeCount: sizeCase.edgeCount,
  storage: storageType.storage,
  receiptField: storageType.receiptField,
  expectedBytes: sizeCase.bytes[storageType.key],
})))

const receipts = JSON.parse(readFileSync(new URL("../results/4_fixture_memory.json", import.meta.url), "utf8")) as Record<string, number>[]

test.each(cases)("$name retains $expectedBytes bytes", testCase => {
  const receipt = receipts.find(value => value.nodeCount === testCase.nodeCount)
  expect(receipt?.[testCase.receiptField]).toBe(testCase.expectedBytes)
})

test.each(sizeCases)("$size packed total decomposes into positions, IDs, and edge endpoints", testCase => {
  expect(rendererFixtureMemory(testCase.nodeCount, testCase.edgeCount)).toMatchObject({ packedRenderBytes: testCase.bytes.packed })
})
