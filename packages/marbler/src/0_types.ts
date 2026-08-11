import { z } from "zod"

export const PhaseSchema = z.object({
  kind: z.enum(["queue", "send", "wait", "receive", "work"]),
  start: z.number(),
  end: z.number(),
})

export const MarbleEventSchema = z.object({
  id: z.string(),
  name: z.string(),
  method: z.string(),
  status: z.number(),
  type: z.string(),
  initiator: z.string(),
  size: z.string(),
  start: z.number(),
  duration: z.number(),
  from: z.string(),
  to: z.string(),
  preview: z.string(),
  phases: z.array(PhaseSchema),
})

export type MarbleEvent = z.infer<typeof MarbleEventSchema>
export type MarblePhase = z.infer<typeof PhaseSchema>
export type EventFilter = "all" | "request" | "result" | "tool" | "note"
