import { execFile } from "node:child_process"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { beforeAll, afterAll, describe, expect, it } from "vitest"

const here = dirname(fileURLToPath(import.meta.url))
const threeRoot = resolve(here, "..")
const pixiRoot = resolve(threeRoot, "..", "6_render_pixijs")
const cacheRoot = resolve(threeRoot, "..", "..", ".cache", "render-fixtures")
const fixtureSize = 9
const fixtureName = `grid-${fixtureSize}`
const fixturePath = resolve(cacheRoot, `${fixtureName}.json`)

type ReceiptFile = {
  protocol: string
  implementation: string
  fixture: string
  geometryHash: string
  nodeCount: number
  edgeCount: number
}

async function writeSharedFixture(): Promise<void> {
  const columns = Math.ceil(Math.sqrt(fixtureSize))
  const nodes = Array.from({ length: fixtureSize }, (_, index) => ({
    id: `n${Math.floor(index / columns)}_${index % columns}`,
    x: (index % columns) * 10,
    y: Math.floor(index / columns) * 10,
  }))
  const edges: [number, number][] = []
  for (let index = 0; index < fixtureSize; index++) {
    const column = index % columns
    if (column + 1 < columns && index + 1 < fixtureSize) edges.push([index, index + 1])
    if (index + columns < fixtureSize) edges.push([index, index + columns])
  }
  await mkdir(cacheRoot, { recursive: true })
  await writeFile(fixturePath, JSON.stringify({
    protocol: "grapht-render-fixture/0",
    id: fixtureName,
    nodeCount: fixtureSize,
    edgeCount: edges.length,
    nodes,
    edges,
  }), "utf8")
}

async function runAdapter(root: string, runId: string, implementation: string): Promise<ReceiptFile> {
  const outputDirectory = resolve(root, "receipts", "generated")
  const request = JSON.stringify({
    protocol: "grapht-bench/0",
    runId,
    fixture: fixtureName,
    operation: "render",
    outputDirectory,
    parameters: { renderer: "webgl", representation: "retained" },
  })
  const child = execFile("node", ["--import", "tsx", "src/3_protocol_adapter.ts"], { cwd: root })
  child.stdin?.end(`${request}\n`)
  await new Promise<void>((done, fail) => {
    child.on("error", fail)
    child.on("close", code => (code === 0 ? done() : fail(new Error(`adapter exited ${code}`))))
  })
  const text = await readFile(resolve(outputDirectory, `${implementation}-${fixtureName}.receipt.json`), "utf8")
  return JSON.parse(text) as ReceiptFile
}

function hashExpression(source: string): string {
  const match = /const geometryHash = .*$/m.exec(source)
  if (!match) throw new Error("geometryHash construction not found")
  return match[0]
}

describe("geometryHash equality across renderer adapters", () => {
  beforeAll(writeSharedFixture)
  afterAll(async () => {
    await rm(fixturePath, { force: true })
  })

  it("computes the hash from byte-for-byte identical inputs in both adapter sources", async () => {
    const three = hashExpression(await readFile(resolve(threeRoot, "src", "3_protocol_adapter.ts"), "utf8"))
    const pixi = hashExpression(await readFile(resolve(pixiRoot, "src", "3_protocol_adapter.ts"), "utf8"))
    expect(three).toBe(pixi)
  })

  it("produces the same geometryHash from a Three.js run and a PixiJS run of the same fixture", async () => {
    const three = await runAdapter(threeRoot, "threejs-hash-equality", "threejs")
    const pixi = await runAdapter(pixiRoot, "pixijs-hash-equality", "pixijs")
    expect(three.geometryHash).toBe(pixi.geometryHash)
    expect(three.geometryHash).toMatch(/^[0-9a-f]{64}$/)
    expect({ nodeCount: three.nodeCount, edgeCount: three.edgeCount }).toEqual({ nodeCount: pixi.nodeCount, edgeCount: pixi.edgeCount })
    expect(three.implementation).toBe("threejs")
    expect(pixi.implementation).toBe("pixijs")
    expect(three.protocol).toBe("grapht-threejs-receipt/0")
  }, 60_000)
})
