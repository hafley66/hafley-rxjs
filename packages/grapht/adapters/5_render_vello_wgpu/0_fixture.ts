export type CommonFixture = {
  protocol: "grapht-render-fixture/0"
  id: string
  nodeCount: number
  edgeCount: number
  nodes: { id: string; x: number; y: number }[]
  edges: [number, number][]
}

export type FixtureLoad = {
  fixture: CommonFixture
  json: string
  source: { url: string; bytes: number; sha256: string }
}

async function sha256(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("")
}

export async function loadCommonFixture(size: number, baseUrl = "/common-fixtures"): Promise<FixtureLoad> {
  const url = `${baseUrl}/grid-${size}.json`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`common fixture request failed: ${response.status} ${url}`)
  const bytes = await response.arrayBuffer()
  const json = new TextDecoder().decode(bytes)
  const fixture = JSON.parse(json) as CommonFixture
  if (fixture.protocol !== "grapht-render-fixture/0" || fixture.id !== `grid-${size}`) throw new Error(`invalid common fixture identity: ${url}`)
  if (fixture.nodeCount !== fixture.nodes.length || fixture.edgeCount !== fixture.edges.length) throw new Error(`common fixture count mismatch: ${url}`)
  for (const [source, target] of fixture.edges) if (source >= fixture.nodeCount || target >= fixture.nodeCount) throw new Error(`common fixture edge endpoint mismatch: ${url}`)
  return { fixture, json, source: { url, bytes: bytes.byteLength, sha256: await sha256(bytes) } }
}
