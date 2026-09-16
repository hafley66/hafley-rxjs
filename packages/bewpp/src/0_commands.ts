import { z } from "zod"
import type { LocatorQuery } from "./0_controls.js"

export const tabSchema = z.number().int().nonnegative().describe("Chrome tab ID returned by tabs_list.")
export const locatorSchema: z.ZodType<LocatorQuery> = z.lazy(() =>
  z
    .object({
      role: z.string().min(1).optional(),
      name: z.string().optional(),
      placeholder: z.string().optional(),
      label: z.string().optional(),
      testid: z.string().optional(),
      selector: z.string().min(1).optional(),
      within: locatorSchema.optional(),
      has: locatorSchema.optional(),
      visible: z.boolean().optional(),
      index: z.number().int().nonnegative().optional(),
    })
    .strict()
    .refine(
      q => [q.role, q.placeholder, q.label, q.testid, q.selector].filter(v => v !== undefined).length === 1,
      "Specify exactly one locator kind.",
    ),
)

export const locatorActionSchema = z
  .object({
    tabId: tabSchema,
    query: locatorSchema,
    action: z.enum([
      "count",
      "visible",
      "enabled",
      "value",
      "texts",
      "click",
      "fill",
      "select",
      "press",
      "hover",
      "wait",
    ]),
    value: z.string().max(16_000).optional(),
    state: z.enum(["visible", "hidden", "detached"]).optional(),
    timeoutMs: z.number().int().min(1).max(30_000).default(5000),
    allowSubmit: z
      .boolean()
      .default(false)
      .describe(
        "Explicitly allow a click on a submission control. Only set when the requested action authorizes submission.",
      ),
  })
  .strict()

export const observationStartSchema = z
  .object({
    tabId: tabSchema,
    sources: z
      .array(z.enum(["dom", "localStorage", "sessionStorage", "indexedDB", "click"]))
      .min(1)
      .max(5),
    selector: z.string().min(1).max(1_000).default("body"),
    includeValues: z.boolean().default(false),
    debounceMs: z.number().int().min(0).max(5_000).default(250),
    maxEvents: z.number().int().min(1).max(5_000).default(500),
    textLimit: z.number().int().min(0).max(50_000).default(12_000),
  })
  .strict()

export const observationReadSchema = z
  .object({
    tabId: tabSchema,
    afterSequence: z.number().int().nonnegative().default(0),
    limit: z.number().int().min(1).max(1_000).default(100),
  })
  .strict()

export const browserCommandSchema = z.union([
  z.object({ op: z.literal("status") }).strict(),
  z.object({ op: z.literal("tabs") }).strict(),
  z.object({ op: z.literal("inspect"), tabId: tabSchema }).strict(),
  z.object({ op: z.literal("images"), tabId: tabSchema }).strict(),
  z.object({ op: z.literal("download"), tabId: tabSchema, url: z.string().min(1).max(16_000) }).strict(),
  z.object({ op: z.literal("navigate"), tabId: tabSchema, url: z.url().max(16_000) }).strict(),
  z.object({ op: z.literal("activate"), tabId: tabSchema }).strict(),
  z
    .object({
      op: z.literal("evaluate"),
      tabId: tabSchema,
      source: z.string().min(1).max(200_000),
      args: z.array(z.unknown()).max(20).default([]),
    })
    .strict(),
  z
    .object({
      op: z.literal("storage"),
      tabId: tabSchema,
      kind: z.enum(["localStorage", "sessionStorage"]),
      key: z.string().max(1_000).optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal("screenshot"),
      tabId: tabSchema,
      fullPage: z.boolean().default(false),
      selector: z.string().max(1_000).optional(),
      format: z.enum(["png", "jpeg"]).default("png"),
    })
    .strict(),
  observationStartSchema.extend({ op: z.literal("observe"), action: z.literal("start") }),
  observationReadSchema.extend({ op: z.literal("observe"), action: z.literal("read") }),
  z.object({ op: z.literal("observe"), action: z.literal("stop"), tabId: tabSchema }).strict(),
  locatorActionSchema.extend({ op: z.literal("query") }),
])
export type BrowserCommand = z.input<typeof browserCommandSchema>
