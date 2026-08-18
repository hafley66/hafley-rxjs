import { z } from "zod"
import type { Topology } from "@hafley66/grapht"
import type { GridConfig } from "@hafley66/grid"
import type { MarbleEvent, MarblePhase } from "@hafley66/marbler"

export const BOOP_AGENT_SNAPSHOT_VERSION = "boop-agent/1"

export type BoopAgentNode = {
  id: string
  harness: string
  sessionId?: string
  parentId?: string | null
  name?: string
  label?: string
  status?: string
  from?: string
  why?: string
  cwd?: string
  metadata?: Record<string, unknown>
}

export type BoopAgentEdge = {
  id?: string
  from: string
  to: string
  kind?: string
  metadata?: Record<string, unknown>
}

export type BoopAgentPhase = {
  kind: string
  start?: number | string | null
  end?: number | string | null
  metadata?: Record<string, unknown>
}

export type BoopAgentEvent = {
  id: string
  kind: string
  nodeId: string
  from?: string
  to?: string
  message?: string
  preview?: string
  start?: number | string | null
  end?: number | string | null
  duration?: number | string | null
  phases?: BoopAgentPhase[]
  metadata?: Record<string, unknown>
}

export type BoopAgentSnapshot = {
  schemaVersion: string
  nodes: BoopAgentNode[]
  edges: BoopAgentEdge[]
  events: BoopAgentEvent[]
}

const metadataSchema = z.record(z.string(), z.unknown())
const nodeSchema = z.object({
  id: z.string().min(1),
  harness: z.string().min(1),
  sessionId: z.string().min(1).optional(),
  parentId: z.string().nullable().optional(),
  name: z.string().optional(),
  label: z.string().optional(),
  status: z.string().optional(),
  from: z.string().optional(),
  why: z.string().optional(),
  cwd: z.string().optional(),
  metadata: metadataSchema.optional(),
})
const edgeSchema = z.object({
  id: z.string().min(1).optional(),
  from: z.string().min(1),
  to: z.string().min(1),
  kind: z.string().optional(),
  metadata: metadataSchema.optional(),
})
const phaseSchema = z.object({
  kind: z.string().min(1),
  start: z.union([z.number(), z.string(), z.null()]).optional(),
  end: z.union([z.number(), z.string(), z.null()]).optional(),
  metadata: metadataSchema.optional(),
})
const eventSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  nodeId: z.string().min(1),
  from: z.string().optional(),
  to: z.string().optional(),
  message: z.string().optional(),
  preview: z.string().optional(),
  start: z.union([z.number(), z.string(), z.null()]).optional(),
  end: z.union([z.number(), z.string(), z.null()]).optional(),
  duration: z.union([z.number(), z.string(), z.null()]).optional(),
  phases: z.array(phaseSchema).optional(),
  metadata: metadataSchema.optional(),
})

export const boopAgentSnapshotSchema = z.object({
  schemaVersion: z.string().min(1),
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
  events: z.array(eventSchema),
})

export type AgentTreeCommunication = {
  id: string
  kind: string
  from: string | null
  to: string | null
  message: string
  timestamp: number | null
  metadata?: Record<string, unknown>
}

export type AgentTreeRow = {
  id: string
  name: string
  kind: "agent"
  harness: string
  sessionId: string
  parentId: string | null
  status: string
  from: string
  why: string
  cwd: string
  communications: AgentTreeCommunication[]
  children?: AgentTreeRow[]
}

export type AgentTimelinePhase = MarblePhase
export type AgentTimelineEvent = MarbleEvent
export type AgentTopology = Topology

export type AgentTreeProjection = (snapshot: BoopAgentSnapshot) => AgentTreeRow[]
export type AgentTreeGridConfig = Pick<GridConfig<AgentTreeRow>, "getRowId" | "getSubRows">
export type AgentTimelineProjection = (snapshot: BoopAgentSnapshot) => AgentTimelineEvent[]
export type AgentTopologyProjection = (snapshot: BoopAgentSnapshot) => AgentTopology

export type BoopSessionRow = {
  session: string
  harness: string
  nickname: string | null
  cwd: string | null
  branch: string | null
  model: string | null
  goal: string | null
  parent: string | null
  spawnedTs: number | null
  openedTs: number | null
  closedTs: number | null
  firstTurnTs: number | null
  lastTurnTs: number | null
  turns: number
}

export type BoopFrameRow = {
  session: string
  ts: number
  kind: string
  peer: string | null
  detail: string
  repeat: number
}

export type AgentNetworkExport = { rows: BoopSessionRow[]; frames: BoopFrameRow[] }

export type AgentNetworkProjection = (input: AgentNetworkExport) => MarbleEvent[]
export type AgentNetworkTopologyProjection = (input: AgentNetworkExport) => Topology

const boopSessionRowSchema = z.object({
  session: z.string().min(1),
  harness: z.string().min(1),
  nickname: z.string().nullable(),
  cwd: z.string().nullable(),
  branch: z.string().nullable(),
  model: z.string().nullable(),
  goal: z.string().nullable(),
  parent: z.string().nullable(),
  spawnedTs: z.number().nullable(),
  openedTs: z.number().nullable(),
  closedTs: z.number().nullable(),
  firstTurnTs: z.number().nullable(),
  lastTurnTs: z.number().nullable(),
  turns: z.number(),
})

const boopFrameRowSchema = z.object({
  session: z.string().min(1),
  ts: z.number(),
  kind: z.string().min(1),
  peer: z.string().nullable(),
  detail: z.string(),
  repeat: z.number(),
})

export const agentNetworkExportSchema = z.object({
  rows: z.array(boopSessionRowSchema),
  frames: z.array(boopFrameRowSchema),
})
