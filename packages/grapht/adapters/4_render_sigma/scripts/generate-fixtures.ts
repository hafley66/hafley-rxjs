import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const fixturesRoot = resolve(here, "..", "fixtures", "geometry")

const FIXTURES = [
  { id: "grid-1k", rows: 32, cols: 32 },
  { id: "grid-5k", rows: 71, cols: 71 },
  { id: "grid-10k", rows: 100, cols: 100 },
]

const SPACING = 10

function gridTopology(rows: number, cols: number) {
  const nodeIds: string[] = []
  const index = new Map<string, number>()
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = `n${r}_${c}`
      index.set(id, nodeIds.length)
      nodeIds.push(id)
    }
  }
  const edges: [number, number][] = []
  const edge = (a: number, b: number): void => {
    edges.push(a < b ? [a, b] : [b, a])
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cur = index.get(`n${r}_${c}`)!
      if (c + 1 < cols) edge(cur, index.get(`n${r}_${c + 1}`)!)
      if (r + 1 < rows) edge(cur, index.get(`n${r + 1}_${c}`)!)
    }
  }
  return { nodeIds, edges }
}

const manifest = {
  protocol: "grapht-geometry/0",
  scalar: "f32-le",
}

for (const fixture of FIXTURES) {
  const { nodeIds, edges } = gridTopology(fixture.rows, fixture.cols)
  const positions = new Float32Array(nodeIds.length * 2)
  for (let i = 0; i < nodeIds.length; i++) {
    const match = /^n(\d+)_(\d+)$/.exec(nodeIds[i])!
    const r = Number(match[1])
    const c = Number(match[2])
    positions[i * 2] = c * SPACING
    positions[i * 2 + 1] = r * SPACING
  }
  const dir = resolve(fixturesRoot, fixture.id)
  await mkdir(dir, { recursive: true })
  await writeFile(resolve(dir, "nodeIds.json"), JSON.stringify(nodeIds), "utf8")
  await writeFile(resolve(dir, "edges.json"), JSON.stringify(edges), "utf8")
  await writeFile(
    resolve(dir, "positions.f32le.bin"),
    new Uint8Array(positions.buffer, positions.byteOffset, positions.byteLength),
  )
  await writeFile(
    resolve(dir, "manifest.json"),
    JSON.stringify(
      {
        ...manifest,
        nodeIds: "nodeIds.json",
        positions: "positions.f32le.bin",
        edges: "edges.json",
        nodeCount: nodeIds.length,
        edgeCount: edges.length,
      },
      null,
      2,
    ),
    "utf8",
  )
  process.stdout.write(
    `${fixture.id}\t${nodeIds.length} nodes\t${edges.length} edges\t${dir}\n`,
  )
}
