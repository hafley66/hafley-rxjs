import { z } from "zod"

// kind is free-form; phaseStyles (createMarbler option) maps kind -> { label, color }.
export const PhaseSchema = z.object({
  kind: z.string(),
  start: z.number().nullable(),
  end: z.number().nullable(),
})

// kind is free-form; severity is the fixed vocabulary driving frame color/variant.
export const FrameSchema = z.object({
  id: z.string(),
  t: z.number(),
  kind: z.string(),
  direction: z.enum(["in", "out", "self"]),
  peer: z.string().nullable(),
  preview: z.string(),
  repeat: z.number().default(1),
  severity: z.enum(["info", "warn", "error", "done"]).optional(),
})

export type PhaseStyle = { label: string; color: string }

// Default vocabulary: queue/send/wait/receive/work, used when no phaseStyles option is given.
export const DEFAULT_PHASE_STYLES: Record<string, PhaseStyle> = {
  queue: { label: "queue", color: "#777f8b" },
  send: { label: "send", color: "#d59b47" },
  wait: { label: "wait", color: "#8e57bc" },
  receive: { label: "receive", color: "#3f8dbd" },
  work: { label: "work", color: "#49a56b" },
}

export const FALLBACK_PHASE_STYLE: PhaseStyle = { label: "phase", color: "#70839b" }

// Hand-written: MarbleEventSchema is self-referential through `children`, so
// z.infer cannot derive it. frames/parentId/children stay optional.
export type MarbleEvent = {
  id: string
  name: string
  method: string
  status: number
  type: string
  initiator: string
  size: string
  start: number | null
  duration: number | null
  from: string
  to: string
  preview: string
  phases: MarblePhase[]
  frames?: MarbleFrame[]
  parentId?: string | null
  children?: MarbleEvent[]
}

export const MarbleEventSchema: z.ZodType<MarbleEvent> = z.object({
  id: z.string(),
  name: z.string(),
  method: z.string(),
  status: z.number(),
  type: z.string(),
  initiator: z.string(),
  size: z.string(),
  start: z.number().nullable(),
  duration: z.number().nullable(),
  from: z.string(),
  to: z.string(),
  preview: z.string(),
  phases: z.array(PhaseSchema),
  frames: z.array(FrameSchema).default([]),
  parentId: z.string().nullable().default(null),
  children: z.lazy(() => z.array(MarbleEventSchema)).optional(),
})

export type MarblePhase = z.infer<typeof PhaseSchema>
export type MarbleFrame = z.infer<typeof FrameSchema>
// "all" plus whatever distinct `type` values the host's events carry.
export type EventFilter = string
