import { describe, expect, it } from "vitest"
import {
  boopAgentRoute,
  boopAgentSnapshotSchema,
  projectAgentTimeline,
  projectAgentTopology,
  projectAgentTree,
  type BoopAgentSnapshot,
} from "./index.js"

const snapshot: BoopAgentSnapshot = {
  schemaVersion: "boop-agent/1",
  nodes: [
    { id: "root", harness: "codex", sessionId: "root-session", label: "Coordinator", status: "running" },
    { id: "child", harness: "codex", sessionId: "child-session", parentId: "codex:root", status: "completed", from: "codex:root" },
    { id: "parallel", harness: "opencode", sessionId: "parallel-session", parentId: "codex:root", status: "error" },
  ],
  edges: [
    { id: "spawn-child", from: "codex:root", to: "codex:child", kind: "spawn" },
    { id: "spawn-parallel", from: "codex:root", to: "opencode:parallel", kind: "spawn" },
    { id: "message-1", from: "codex:root", to: "codex:child", kind: "communication" },
  ],
  events: [
    { id: "send-1", kind: "send", nodeId: "codex:root", from: "codex:root", to: "codex:child", message: "begin", start: 10, end: 20, phases: [{ kind: "send", start: 10, end: 12 }] },
    { id: "send-2", kind: "send", nodeId: "codex:root", from: "codex:root", to: "codex:child", message: "follow-up", start: 22, duration: 3 },
    { id: "receive-1", kind: "receive", nodeId: "codex:child", from: "codex:child", to: "codex:root", message: "done", start: 30, phases: [{ kind: "receive", start: 30, end: 31 }] },
    { id: "work-1", kind: "work", nodeId: "opencode:parallel", message: "parallel work", start: 14, end: 19 },
    { id: "complete-1", kind: "complete", nodeId: "codex:child", start: 40 },
    { id: "error-1", kind: "error", nodeId: "opencode:parallel", message: "failed", start: 41 },
    { id: "note-1", kind: "note", nodeId: "codex:root", message: "no end timestamp" },
  ],
}

describe("Boop snapshot adapters", () => {
  it("validates canonical producer fields and rejects aliases or ambiguous identities", () => {
    expect(boopAgentSnapshotSchema.parse(snapshot).schemaVersion).toBe("boop-agent/1")
    expect(() => boopAgentSnapshotSchema.parse({ ...snapshot, edges: [{ source: "codex:root", target: "codex:child" }] })).toThrow()
    expect(() => projectAgentTopology({ ...snapshot, edges: [{ from: "root", to: "codex:child" }] })).toThrow("unknown agent")
    expect(() => projectAgentTopology({ ...snapshot, nodes: [...snapshot.nodes, { id: "root", harness: "codex" }] })).toThrow("duplicate")
  })

  it("projects nested sessions and repeated communications into GridTree rows", () => {
    const rows = projectAgentTree(snapshot)
    const compactRows = rows.map((row) => ({
      id: row.id,
      children: row.children?.map((child) => child.id).join(","),
      communications: row.communications.map((communication) => `${communication.id}:${communication.kind}:${communication.timestamp ?? "missing"}`).join("|"),
      childCommunications: row.children?.map((child) => `${child.id}=${child.communications.map((communication) => `${communication.id}:${communication.kind}:${communication.timestamp ?? "missing"}`).join(",")}`).join("|"),
    }))
    expect(compactRows).toMatchInlineSnapshot(`
      [
        {
          "childCommunications": "codex:child=send-1:send:10,send-2:send:22,receive-1:receive:30,complete-1:complete:40|opencode:parallel=work-1:work:14,error-1:error:41",
          "children": "codex:child,opencode:parallel",
          "communications": "send-1:send:10|send-2:send:22|receive-1:receive:30|note-1:note:missing",
          "id": "codex:root",
        },
      ]
    `)
  })

  it("returns native MarbleEvent and Topology records without fabricated timing", () => {
    const compactTimeline = projectAgentTimeline(snapshot).map(({ id, method, start, duration, phases, from, to, status }) => ({ id, method, start, duration, phaseKinds: phases.map((phase) => phase.kind).join(","), from, to, status }))
    expect(compactTimeline).toMatchInlineSnapshot(`
      [
        {
          "duration": 10,
          "from": "codex:root",
          "id": "send-1",
          "method": "SEND",
          "phaseKinds": "send",
          "start": 10,
          "status": 102,
          "to": "codex:child",
        },
        {
          "duration": 3,
          "from": "codex:root",
          "id": "send-2",
          "method": "SEND",
          "phaseKinds": "",
          "start": 22,
          "status": 102,
          "to": "codex:child",
        },
        {
          "duration": null,
          "from": "codex:child",
          "id": "receive-1",
          "method": "RECV",
          "phaseKinds": "receive",
          "start": 30,
          "status": 200,
          "to": "codex:root",
        },
        {
          "duration": 5,
          "from": "opencode:parallel",
          "id": "work-1",
          "method": "WORK",
          "phaseKinds": "",
          "start": 14,
          "status": 102,
          "to": "",
        },
        {
          "duration": null,
          "from": "codex:child",
          "id": "complete-1",
          "method": "DONE",
          "phaseKinds": "",
          "start": 40,
          "status": 200,
          "to": "",
        },
        {
          "duration": null,
          "from": "opencode:parallel",
          "id": "error-1",
          "method": "ERROR",
          "phaseKinds": "",
          "start": 41,
          "status": 500,
          "to": "",
        },
        {
          "duration": null,
          "from": "codex:root",
          "id": "note-1",
          "method": "NOTE",
          "phaseKinds": "",
          "start": null,
          "status": 102,
          "to": "",
        },
      ]
    `)
    expect(projectAgentTopology(snapshot)).toEqual({ nodeIds: ["codex:root", "codex:child", "opencode:parallel"], edges: [[0, 1], [0, 2], [0, 1]] })
    expect(boopAgentRoute.path).toContain("harness")
  })
})
