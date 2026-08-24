import type { RendererFixture } from "../../../src/10_rendererFixture.js"
import type { Geometry } from "../../../src/1_geometryProtocol.js"

export const DEFAULT_SPACING = 10

export function fixtureSize(name: string): number {
  const match = /(?:grid[-_])?(\d+(?:\.\d+)?)(k|m)?$/i.exec(name)
  if (!match) throw new Error(`unsupported fixture ${name}`)
  const multiplier = match[2]?.toLowerCase() === "m" ? 1_000_000 : match[2] ? 1_000 : 1
  const value = Math.round(Number(match[1]) * multiplier)
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`invalid fixture size ${name}`)
  return value
}

export type CommonFixtureLoad = {
  geometry: Geometry
  fixture: RendererFixture
  source: { url: string; bytes: number; sha256: string }
}

async function sha256(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("")
}

export async function loadCommonFixture(size: number, baseUrl = "/common-fixtures"): Promise<CommonFixtureLoad> {
  const url = `${baseUrl}/grid-${size}.json`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`common fixture request failed: ${response.status} ${url}`)
  const bytes = await response.arrayBuffer()
  const fixture = JSON.parse(new TextDecoder().decode(bytes)) as RendererFixture
  if (fixture.protocol !== "grapht-render-fixture/0" || fixture.id !== `grid-${size}`) {
    throw new Error(`invalid common fixture identity: ${url}`)
  }
  if (fixture.nodeCount !== fixture.nodes.length || fixture.edgeCount !== fixture.edges.length) {
    throw new Error(`common fixture manifest count mismatch: ${url}`)
  }
  const nodeIds = fixture.nodes.map(node => node.id)
  const positions = new Float32Array(fixture.nodes.length * 2)
  for (let index = 0; index < fixture.nodes.length; index++) {
    positions[index * 2] = fixture.nodes[index].x
    positions[index * 2 + 1] = fixture.nodes[index].y
  }
  return {
    geometry: { nodeIds, positions, edges: fixture.edges },
    fixture,
    source: { url, bytes: bytes.byteLength, sha256: await sha256(bytes) },
  }
}
