import type { SequenceOccurrenceDocument } from "@hafley66/grapht-model"
import {
  descendantsOf,
  type NativeRenderReceipt,
  parentPath,
  SvgBindingBuilder,
  type SvgBindingReceipt,
} from "@hafley66/grapht-model"
import type { D2SequenceDocument } from "./0_types"

function firstDescendant(
  receipt: NativeRenderReceipt,
  path: number[],
  predicate: (element: NativeRenderReceipt["elements"][number]) => boolean,
) {
  return descendantsOf(receipt.elements, path).find(predicate)
}

function occurrenceAt(
  occurrences: SequenceOccurrenceDocument,
  kind: "actor" | "group" | "activation" | "note",
  sourceSpan: { start: number; end: number },
) {
  return occurrences.occurrences.find(
    occurrence =>
      occurrence.kind === kind &&
      occurrence.sourceSpan?.start === sourceSpan.start &&
      occurrence.sourceSpan.end === sourceSpan.end,
  )
}

/** Uses D2's generated object groups and connection ordering. */
export function bindD2Svg(
  document: D2SequenceDocument,
  occurrences: SequenceOccurrenceDocument,
  receipt: NativeRenderReceipt,
): SvgBindingReceipt {
  const builder = new SvgBindingBuilder("d2", receipt)
  const actorShapeAndLabel = document.actors.map(actor => {
    const label = receipt.elements.find(element => element.tag === "text" && element.text === actor.label)
    return { actor, label, root: label ? parentPath(label.path) : undefined }
  })
  const lifelines = receipt.elements.filter(
    element =>
      element.tag === "path" && element.classes.includes("connection") && element.classes.includes("stroke-B2"),
  )

  for (const [index, actor] of actorShapeAndLabel.entries()) {
    const occurrence = occurrenceAt(occurrences, "actor", actor.actor.sourceSpan)
    if (!occurrence || !actor.label || !actor.root) continue
    const shape = firstDescendant(
      receipt,
      actor.root,
      element => element.tag === "g" && element.classes.includes("shape"),
    )
    if (shape) builder.add(occurrence, "actor-shape", shape)
    builder.add(occurrence, "actor-label", actor.label)
    if (lifelines[index]) builder.add(occurrence, "lifeline", lifelines[index])
  }

  const messageOccurrences = occurrences.occurrences.filter(occurrence => occurrence.kind === "message")
  const messageLines = receipt.elements.filter(
    element =>
      element.tag === "path" &&
      element.classes.includes("connection") &&
      element.classes.includes("stroke-B1") &&
      Boolean(element.attributes["marker-end"]),
  )
  const messageLabels = receipt.elements.filter(
    element => element.tag === "text" && element.classes.includes("text-italic"),
  )

  for (const [index, occurrence] of messageOccurrences.entries()) {
    if (messageLines[index]) builder.add(occurrence, "message-line", messageLines[index])
    if (messageLabels[index]) builder.add(occurrence, "message-label", messageLabels[index])
  }

  for (const group of document.groups) {
    const occurrence = occurrenceAt(occurrences, "group", group.sourceSpan)
    if (!occurrence) continue
    const label = receipt.elements.find(element => element.tag === "text" && element.text === group.label)
    if (!label) continue
    const root = parentPath(label.path)
    const shape = firstDescendant(
      receipt,
      root,
      element => element.tag === "g" && element.classes.includes("shape") && element.classes.includes("blend"),
    )
    if (shape) builder.add(occurrence, "group-frame", shape)
    builder.add(occurrence, "group-label", label)
  }

  for (const span of document.spans) {
    const occurrence = occurrenceAt(occurrences, "activation", span.sourceSpan)
    const element = receipt.elements.find(
      candidate =>
        candidate.tag === "g" &&
        candidate.classes.includes("shape") &&
        descendantsOf(receipt.elements, candidate.path).some(
          descendant => descendant.tag === "rect" && descendant.attributes.width === "12.000000",
        ),
    )
    if (occurrence && element) builder.add(occurrence, "activation", element)
  }

  for (const note of document.notes) {
    const occurrence = occurrenceAt(occurrences, "note", note.sourceSpan)
    const label = receipt.elements.find(element => element.tag === "text" && element.text === note.label)
    if (!occurrence || !label) continue
    const root = parentPath(label.path)
    const shape = firstDescendant(
      receipt,
      root,
      element => element.tag === "g" && element.classes.includes("shape") && !element.classes.includes("blend"),
    )
    if (shape) builder.add(occurrence, "note-shape", shape)
    builder.add(occurrence, "note-label", label)
  }

  return builder.finish(occurrences.occurrences)
}
