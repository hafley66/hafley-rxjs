import type { AgentTimelineEvent, AgentTimelinePhase, AgentTimelineProjection, BoopAgentEvent, BoopAgentSnapshot } from "./0_types.js"
import { eventEnd, eventIdentity, eventStart, nodeIdentity, parseBoopAgentSnapshot, resolveIdentity, timeOf } from "./1_validate.js"

const phaseKinds = new Set<AgentTimelinePhase["kind"]>(["queue", "send", "wait", "receive", "work"])
const methodOf: Record<string, string> = { send: "SEND", receive: "RECV", spawn: "SPAWN", work: "WORK", complete: "DONE", error: "ERROR" }

function phaseOf(event: BoopAgentEvent): AgentTimelinePhase[] {
  return (event.phases ?? []).flatMap((phase) => {
    const start = timeOf(phase.start)
    const end = timeOf(phase.end)
    const kind = phase.kind.toLowerCase() as AgentTimelinePhase["kind"]
    return start !== null && end !== null && phaseKinds.has(kind) ? [{ kind, start, end }] : []
  })
}

function timelineEvent(event: BoopAgentEvent, index: number, owner: string, from: string, to: string): AgentTimelineEvent {
  const start = eventStart(event)
  const end = eventEnd(event)
  const rawDuration = timeOf(event.duration)
  const duration = rawDuration ?? (start !== null && end !== null ? Math.max(0, end - start) : null)
  const status = event.kind === "error" ? 500 : event.kind === "complete" ? 200 : event.kind === "receive" ? 200 : 102
  return {
    id: eventIdentity(event),
    name: event.message ?? event.preview ?? event.kind,
    method: methodOf[event.kind.toLowerCase()] ?? event.kind.toUpperCase(),
    status,
    type: event.kind,
    initiator: owner,
    size: "",
    start,
    duration,
    from,
    to,
    preview: event.message ?? event.preview ?? "",
    phases: phaseOf(event),
  }
}

export const projectAgentTimeline: AgentTimelineProjection = (input) => {
  const snapshot = parseBoopAgentSnapshot(input)
  const identities = new Set(snapshot.nodes.map((node) => nodeIdentity(node.harness, node.id)))
  return snapshot.events.map((event, index) => {
    const from = resolveIdentity(identities, event.from ?? event.nodeId) ?? event.from ?? ""
    const to = resolveIdentity(identities, event.to ?? "") ?? event.to ?? ""
    const owner = from || to || "unknown"
    return timelineEvent({ ...event, from, to }, index, owner, from, to)
  })
}

export const agentTimelineProjection = projectAgentTimeline
export const boopAgentTimeline = projectAgentTimeline
