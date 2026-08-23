import { z } from "zod"

import {
  documentFingerprint,
  type SequenceOccurrenceDocument,
  validateSequenceRelations,
} from "./0_sequenceIdentity.js"
import type { NativeRenderReceipt, SvgBindingReceipt } from "./1_sequenceSvgBinding.js"

export const SEQUENCE_ARTIFACT_PROTOCOL = "grapht-sequence/0"

export type SequenceRenderOptions = {
  signal?: AbortSignal
  options?: unknown
}

export type SequenceSourceAdapter<LocalDocument> = {
  readonly language: "mermaid" | "d2"
  readonly adapterVersion: string
  parse(source: string): LocalDocument
  identify(document: LocalDocument): SequenceOccurrenceDocument
  render(source: string, options: SequenceRenderOptions): Promise<NativeRenderReceipt>
  bind(
    document: LocalDocument,
    occurrences: SequenceOccurrenceDocument,
    receipt: NativeRenderReceipt,
  ): SvgBindingReceipt
}

export type SequenceSourceRevision = {
  id: string
  locator: string
  sourceHash: string
  adapterVersion: string
}

export type SequenceRenderRevision = {
  id: string
  sourceRevisionId: string
  rendererPackage: string
  rendererVersion: string
  rendererOptionsHash: string
}

export type SequenceBindingRevision = {
  id: string
  sourceRevisionId: string
  renderRevisionId: string
  adapterVersion: string
  bindingHash: string
}

export type SequenceArtifact = {
  protocol: typeof SEQUENCE_ARTIFACT_PROTOCOL
  language: "mermaid" | "d2"
  sourceRevision: SequenceSourceRevision
  renderRevision: SequenceRenderRevision
  bindingRevision: SequenceBindingRevision
  occurrences: SequenceOccurrenceDocument["occurrences"]
  relations: SequenceOccurrenceDocument["relations"]
  bindings: SvgBindingReceipt["bindings"]
}

export type SequenceArtifactBuild<LocalDocument> = {
  artifact: SequenceArtifact
  bindingReceipt: SvgBindingReceipt
  localDocument: LocalDocument
  renderReceipt: NativeRenderReceipt
}

const sourceSpanSchema = z.object({
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
  lineStart: z.number().int().positive(),
  lineEnd: z.number().int().positive(),
})

const occurrenceSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["actor", "message", "group", "activation", "note"]),
  parentId: z.string().min(1).optional(),
  ordinal: z.number().int().nonnegative(),
  sourceSpan: sourceSpanSchema.optional(),
  authoredId: z.string().min(1).optional(),
  structuralKey: z.string().min(1),
  label: z.string().optional(),
})

const relationSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["message", "contains", "activates"]),
  occurrenceId: z.string().min(1).optional(),
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
  ordinal: z.number().int().nonnegative(),
})

const bindingSchema = z.object({
  occurrenceId: z.string().min(1),
  role: z.enum([
    "actor-shape",
    "actor-label",
    "lifeline",
    "message-line",
    "message-label",
    "group-frame",
    "group-label",
    "activation",
    "note-shape",
    "note-label",
  ]),
  elementId: z.string().min(1),
  ordinal: z.number().int().nonnegative(),
})

export const sequenceArtifactSchema = z.object({
  protocol: z.literal(SEQUENCE_ARTIFACT_PROTOCOL),
  language: z.enum(["mermaid", "d2"]),
  sourceRevision: z.object({
    id: z.string().min(1),
    locator: z.string().min(1),
    sourceHash: z.string().regex(/^[a-f0-9]{8}$/),
    adapterVersion: z.string().min(1),
  }),
  renderRevision: z.object({
    id: z.string().min(1),
    sourceRevisionId: z.string().min(1),
    rendererPackage: z.string().min(1),
    rendererVersion: z.string().min(1),
    rendererOptionsHash: z.string().regex(/^[a-f0-9]{8}$/),
  }),
  bindingRevision: z.object({
    id: z.string().min(1),
    sourceRevisionId: z.string().min(1),
    renderRevisionId: z.string().min(1),
    adapterVersion: z.string().min(1),
    bindingHash: z.string().regex(/^[a-f0-9]{8}$/),
  }),
  occurrences: z.array(occurrenceSchema),
  relations: z.array(relationSchema),
  bindings: z.array(bindingSchema),
})

export function buildSequenceArtifact<LocalDocument>(
  adapter: SequenceSourceAdapter<LocalDocument>,
  input: { locator: string; source: string; renderOptions?: unknown; signal?: AbortSignal },
): Promise<SequenceArtifactBuild<LocalDocument>> {
  return buildArtifact(adapter, input)
}

async function buildArtifact<LocalDocument>(
  adapter: SequenceSourceAdapter<LocalDocument>,
  input: { locator: string; source: string; renderOptions?: unknown; signal?: AbortSignal },
): Promise<SequenceArtifactBuild<LocalDocument>> {
  input.signal?.throwIfAborted()
  const sourceHash = documentFingerprint(input.source)
  const sourceRevision: SequenceSourceRevision = {
    id: `source:${documentFingerprint([input.locator, sourceHash, adapter.adapterVersion])}`,
    locator: input.locator,
    sourceHash,
    adapterVersion: adapter.adapterVersion,
  }
  const localDocument = adapter.parse(input.source)
  const occurrences = adapter.identify(localDocument)
  const relationValidation = validateSequenceRelations(occurrences)

  if (!relationValidation.valid) {
    throw new Error(relationValidation.diagnostics.map(diagnostic => diagnostic.message).join("\n"))
  }

  const renderReceipt = await adapter.render(input.source, {
    signal: input.signal,
    options: input.renderOptions,
  })
  input.signal?.throwIfAborted()
  const renderRevision: SequenceRenderRevision = {
    id: `render:${documentFingerprint([
      sourceRevision.id,
      renderReceipt.rendererPackage,
      renderReceipt.rendererVersion,
      renderReceipt.options,
      input.renderOptions,
    ])}`,
    sourceRevisionId: sourceRevision.id,
    rendererPackage: renderReceipt.rendererPackage,
    rendererVersion: renderReceipt.rendererVersion,
    rendererOptionsHash: documentFingerprint([renderReceipt.options, input.renderOptions]),
  }
  const bindingReceipt = adapter.bind(localDocument, occurrences, renderReceipt)
  const unboundOccurrenceIds = new Set(bindingReceipt.unboundOccurrenceIds)
  const serializedOccurrences = occurrences.occurrences.filter(occurrence => !unboundOccurrenceIds.has(occurrence.id))
  const serializedOccurrenceIds = new Set(serializedOccurrences.map(occurrence => occurrence.id))
  const serializedRelations = occurrences.relations.filter(
    relation => serializedOccurrenceIds.has(relation.sourceId) && serializedOccurrenceIds.has(relation.targetId),
  )
  const bindingRevision: SequenceBindingRevision = {
    id: `binding:${documentFingerprint([
      sourceRevision.id,
      renderRevision.id,
      adapter.adapterVersion,
      bindingReceipt.bindings,
      bindingReceipt.elementPaths,
    ])}`,
    sourceRevisionId: sourceRevision.id,
    renderRevisionId: renderRevision.id,
    adapterVersion: adapter.adapterVersion,
    bindingHash: documentFingerprint([bindingReceipt.bindings, bindingReceipt.elementPaths]),
  }
  const artifact: SequenceArtifact = {
    protocol: SEQUENCE_ARTIFACT_PROTOCOL,
    language: adapter.language,
    sourceRevision,
    renderRevision,
    bindingRevision,
    occurrences: serializedOccurrences,
    relations: serializedRelations,
    bindings: bindingReceipt.bindings,
  }

  sequenceArtifactSchema.parse(artifact)
  return { artifact, bindingReceipt, localDocument, renderReceipt }
}

export type SequenceArtifactCurrent<LocalDocument> =
  | { status: "current"; result: SequenceArtifactBuild<LocalDocument> }
  | { status: "superseded" }

export function createSequenceArtifactCurrent<LocalDocument>(adapter: SequenceSourceAdapter<LocalDocument>) {
  let controller: AbortController | undefined
  let current: SequenceArtifactBuild<LocalDocument> | undefined

  return {
    get current() {
      return current
    },
    async update(input: { locator: string; source: string; renderOptions?: unknown }) {
      controller?.abort()
      const request = new AbortController()
      controller = request
      let result: SequenceArtifactBuild<LocalDocument>

      try {
        result = await buildSequenceArtifact(adapter, { ...input, signal: request.signal })
      } catch (error) {
        if (request.signal.aborted) return { status: "superseded" } satisfies SequenceArtifactCurrent<LocalDocument>
        throw error
      }

      if (controller !== request || request.signal.aborted) {
        return { status: "superseded" } satisfies SequenceArtifactCurrent<LocalDocument>
      }

      current = result
      return { status: "current", result } satisfies SequenceArtifactCurrent<LocalDocument>
    },
  }
}
