import { z } from "zod"

export const PhaseSchema = z.object({
  kind: z.enum(["queue", "send", "wait", "receive", "work"]),
  start: z.number().nullable(),
  end: z.number().nullable(),
})

export const FrameSchema = z.object({
  id: z.string(),
  t: z.number(),
  kind: z.enum(["spawn", "turn-start", "turn-finish", "mail-in", "mail-out", "result", "error", "exit"]),
  direction: z.enum(["in", "out", "self"]),
  peer: z.string().nullable(),
  preview: z.string(),
  repeat: z.number().default(1),
})

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
export type EventFilter = "all" | "request" | "result" | "tool" | "note"
