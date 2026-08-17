import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { flattenNetworkRows, projectAgentNetwork, projectAgentNetworkTopology, type AgentNetworkExport, type BoopFrameRow, type BoopSessionRow } from "./index.js"

const fixtureDir = fileURLToPath(new URL("../fixtures/", import.meta.url))

function loadNdjson<Row>(name: string): Row[] {
  return readFileSync(`${fixtureDir}${name}`, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as Row)
}

const rows = loadNdjson<BoopSessionRow>("2026-08-17-agent-network.rows.ndjson")
const frames = loadNdjson<BoopFrameRow>("2026-08-17-agent-network.frames.ndjson")
const fixture: AgentNetworkExport = { rows, frames }

const subagentSession = "ce26f5c3-b493-4acc-bb2c-5e0b29f9fe39/agent-aaffd69d1573c147f"
const subagentParent = "ce26f5c3-b493-4acc-bb2c-5e0b29f9fe39"

// projectAgentNetwork returns MarbleEvent[] structurally; these extra fields
// land on MarbleEvent once the marbler network view merges.
type NetworkTestRow = { id: string; status: number; frames: { kind: string }[]; children?: NetworkTestRow[] }

function asTestRows(nodes: ReturnType<typeof projectAgentNetwork>): NetworkTestRow[] {
  return nodes as unknown as NetworkTestRow[]
}

function findRow(nodes: NetworkTestRow[], session: string): NetworkTestRow | undefined {
  for (const node of nodes) {
    if (node.id === session) return node
    const nested = node.children ? findRow(node.children, session) : undefined
    if (nested) return nested
  }
  return undefined
}

describe("agent network adapters", () => {
  it("nests a real subagent row under its parent row's children", () => {
    const network = asTestRows(projectAgentNetwork(fixture))
    const parentRow = findRow(network, subagentParent)
    expect(parentRow).toBeDefined()
    const childIds = parentRow?.children?.map((child) => child.id) ?? []
    expect(childIds).toContain(subagentSession)
    expect(subagentSession).toMatch(/\/agent-[0-9a-f]+$/)
  })

  it("marks an open row status 101", () => {
    const network = asTestRows(projectAgentNetwork(fixture))
    const row = findRow(network, subagentSession)
    expect(row).toBeDefined()
    expect(rows.find((sessionRow) => sessionRow.session === subagentSession)?.closedTs).toBeNull()
    expect(row?.status).toBe(101)
  })

  it("carries the expected frame kind set for a real session", () => {
    const network = asTestRows(projectAgentNetwork(fixture))
    const row = findRow(network, subagentSession)
    const kinds = new Set(row?.frames.map((frame) => frame.kind) ?? [])
    expect(kinds).toEqual(new Set(["spawned", "user", "assistant", "tool"]))
  })

  it("returns a topology whose nodeIds match row count and edges stay in range", () => {
    const topology = projectAgentNetworkTopology(fixture)
    expect(topology.nodeIds.length).toBe(rows.length)
    for (const [from, to] of topology.edges) {
      expect(from).toBeGreaterThanOrEqual(0)
      expect(from).toBeLessThan(topology.nodeIds.length)
      expect(to).toBeGreaterThanOrEqual(0)
      expect(to).toBeLessThan(topology.nodeIds.length)
    }
  })

  it("flattens to only roots when nothing is expanded", () => {
    const network = projectAgentNetwork(fixture)
    const flattened = flattenNetworkRows(network, new Set())
    expect(flattened.length).toBe(network.length)
    expect(flattened.map((row) => row.id)).toEqual(network.map((row) => row.id))
  })
})
