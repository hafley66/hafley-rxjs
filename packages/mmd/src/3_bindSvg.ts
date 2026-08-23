import type { SequenceOccurrenceDocument } from "@hafley66/grapht-model"
import {
  descendantsOf,
  type NativeRenderReceipt,
  parentPath,
  SvgBindingBuilder,
  type SvgBindingReceipt,
} from "@hafley66/grapht-model"
import type { MermaidSequenceDocument, MermaidStatement } from "./0_types"

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

function nestedStatements(statements: MermaidStatement[]): MermaidStatement[] {
  const result: MermaidStatement[] = []

  for (const statement of statements) {
    result.push(statement)
    if (statement.kind === "group") result.push(...nestedStatements(statement.statements))
  }

  return result
}

/** Uses Mermaid's participant data attributes and sequence element ordering. */
export function bindMermaidSvg(
  document: MermaidSequenceDocument,
  occurrences: SequenceOccurrenceDocument,
  receipt: NativeRenderReceipt,
): SvgBindingReceipt {
  const builder = new SvgBindingBuilder("mermaid", receipt)

  for (const participant of document.participants) {
    const occurrence = occurrenceAt(occurrences, "actor", participant.sourceSpan)
    const participantRoot = receipt.elements.find(
      element => element.tag === "g" && element.attributes["data-id"] === participant.id,
    )
    const lifeline = receipt.elements.find(
      element => element.tag === "line" && element.attributes["data-id"] === participant.id,
    )

    if (!occurrence || !participantRoot || !lifeline) continue

    const shape = firstDescendant(
      receipt,
      participantRoot.path,
      element => element.tag === "rect" && element.classes.includes("actor-top"),
    )
    const label = firstDescendant(
      receipt,
      participantRoot.path,
      element => element.tag === "tspan" && element.text === participant.label,
    )

    if (shape) builder.add(occurrence, "actor-shape", shape)
    if (label) builder.add(occurrence, "actor-label", label)
    builder.add(occurrence, "lifeline", lifeline)
  }

  const messageOccurrences = occurrences.occurrences.filter(occurrence => occurrence.kind === "message")
  const messageLines = receipt.elements.filter(
    element =>
      (element.tag === "line" || element.tag === "path") &&
      element.classes.includes("messageLine0") &&
      element.attributes["data-et"] === "message",
  )
  const messageLabels = receipt.elements.filter(
    element => element.tag === "text" && element.classes.includes("messageText"),
  )

  for (const [index, occurrence] of messageOccurrences.entries()) {
    const line = messageLines[index]
    const label = messageLabels[index]
    if (line) builder.add(occurrence, "message-line", line)
    if (label) builder.add(occurrence, "message-label", label)
  }

  for (const statement of nestedStatements(document.statements)) {
    if (statement.kind !== "group") continue
    const group = occurrenceAt(occurrences, "group", statement.sourceSpan)
    if (!group) continue
    const text = receipt.elements.find(element => element.tag === "tspan" && element.text === `[${statement.label}]`)
    if (!text) continue

    const framePath = parentPath(parentPath(text.path))
    const frame = descendantsOf(receipt.elements, framePath).filter(
      element => element.tag === "line" && element.classes.includes("loopLine"),
    )

    for (const [index, element] of frame.entries()) builder.add(group, "group-frame", element, index)
    builder.add(group, "group-label", text)
  }

  const activationElement = receipt.elements.find(
    element => element.tag === "rect" && element.classes.some(className => /^activation\d+$/.test(className)),
  )
  const activationStatement = nestedStatements(document.statements).find(
    statement => statement.kind === "activation" && statement.action === "activate",
  )
  const activation = activationStatement
    ? occurrenceAt(occurrences, "activation", activationStatement.sourceSpan)
    : undefined
  if (activation && activationElement) builder.add(activation, "activation", activationElement)

  for (const statement of nestedStatements(document.statements)) {
    if (statement.kind !== "note") continue
    const note = occurrenceAt(occurrences, "note", statement.sourceSpan)
    if (!note) continue
    const label = receipt.elements.find(element => element.tag === "tspan" && element.text === statement.label)
    if (!label) continue
    const noteRoot = parentPath(parentPath(label.path))
    const shape = firstDescendant(
      receipt,
      noteRoot,
      element => element.tag === "rect" && element.classes.includes("note"),
    )
    if (shape) builder.add(note, "note-shape", shape)
    builder.add(note, "note-label", label)
  }

  return builder.finish(occurrences.occurrences)
}
