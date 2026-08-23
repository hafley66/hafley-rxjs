import { documentFingerprint, type SequenceOccurrence } from "./0_sequenceIdentity.js"

export type SvgBindingRole =
  | "actor-shape"
  | "actor-label"
  | "lifeline"
  | "message-line"
  | "message-label"
  | "group-frame"
  | "group-label"
  | "activation"
  | "note-shape"
  | "note-label"

export type NativeSvgElement = {
  path: number[]
  tag: string
  id?: string
  classes: string[]
  text?: string
  attributes: Record<string, string>
}

export type NativeRenderReceipt = {
  language: "mermaid" | "d2"
  rendererPackage: string
  rendererVersion: string
  sourceHash: string
  svgHash: string
  options: unknown
  svg: string
  elements: NativeSvgElement[]
}

export type SvgBinding = {
  occurrenceId: string
  role: SvgBindingRole
  elementId: string
  ordinal: number
}

export type SvgBindingReceipt = {
  bindings: SvgBinding[]
  elementPaths: Record<string, number[]>
  unboundOccurrenceIds: string[]
  multiplyBoundOccurrenceIds: string[]
  unclaimedElementPaths: number[][]
}

export function pathKey(path: number[]): string {
  return path.join(".")
}

export function descendantsOf(elements: NativeSvgElement[], parentPath: number[]): NativeSvgElement[] {
  return elements.filter(
    element =>
      element.path.length > parentPath.length && parentPath.every((part, index) => element.path[index] === part),
  )
}

export function parentPath(path: number[]): number[] {
  return path.slice(0, -1)
}

export function elementIdForBinding(
  language: NativeRenderReceipt["language"],
  occurrence: SequenceOccurrence,
  role: SvgBindingRole,
  ordinal: number,
): string {
  const fingerprint = documentFingerprint([occurrence.id, role, ordinal])
  return `sequence-binding-${language}-${fingerprint}`
}

export class SvgBindingBuilder {
  readonly bindings: SvgBinding[] = []
  readonly elementPaths: Record<string, number[]> = {}
  readonly boundOccurrenceIds = new Set<string>()
  readonly claimedPaths = new Set<string>()

  constructor(
    readonly language: NativeRenderReceipt["language"],
    readonly receipt: NativeRenderReceipt,
  ) {}

  add(occurrence: SequenceOccurrence, role: SvgBindingRole, element: NativeSvgElement, ordinal = 0) {
    const elementId = element.id ?? elementIdForBinding(this.language, occurrence, role, ordinal)

    this.bindings.push({ occurrenceId: occurrence.id, role, elementId, ordinal })
    this.elementPaths[elementId] = [...element.path]
    this.boundOccurrenceIds.add(occurrence.id)
    this.claimedPaths.add(pathKey(element.path))
  }

  finish(occurrences: SequenceOccurrence[]): SvgBindingReceipt {
    const bindingKeys = new Set<string>()
    const multiplyBoundOccurrenceIds = new Set<string>()

    for (const binding of this.bindings) {
      const key = `${binding.occurrenceId}/${binding.role}/${binding.ordinal}`
      if (bindingKeys.has(key)) multiplyBoundOccurrenceIds.add(binding.occurrenceId)
      bindingKeys.add(key)
    }

    return {
      bindings: this.bindings,
      elementPaths: this.elementPaths,
      unboundOccurrenceIds: occurrences
        .filter(occurrence => !this.boundOccurrenceIds.has(occurrence.id))
        .map(occurrence => occurrence.id),
      multiplyBoundOccurrenceIds: [...multiplyBoundOccurrenceIds],
      unclaimedElementPaths: this.receipt.elements
        .filter(element => !this.claimedPaths.has(pathKey(element.path)))
        .map(element => [...element.path]),
    }
  }
}

type OpenSvgElement = {
  path: number[]
  start: number
  end: number
}

function svgOpenElements(svg: string): OpenSvgElement[] {
  const elements: OpenSvgElement[] = []
  const stack: Array<{ path: number[]; childCount: number }> = []
  let offset = 0

  while (offset < svg.length) {
    const start = svg.indexOf("<", offset)
    if (start === -1) break

    if (svg.startsWith("<!--", start)) {
      offset = svg.indexOf("-->", start) + 3
      continue
    }

    if (svg.startsWith("<![CDATA[", start)) {
      offset = svg.indexOf("]]>", start) + 3
      continue
    }

    if (svg.startsWith("<?", start) || svg.startsWith("<!", start)) {
      offset = svg.indexOf(">", start) + 1
      continue
    }

    let end = start + 1
    let quote: string | undefined

    while (end < svg.length) {
      const character = svg[end]
      if (quote) {
        if (character === quote) quote = undefined
      } else if (character === '"' || character === "'") {
        quote = character
      } else if (character === ">") {
        break
      }
      end += 1
    }

    const tag = svg.slice(start, end + 1)

    if (tag.startsWith("</")) {
      stack.pop()
      offset = end + 1
      continue
    }

    if (!/^<\s*[A-Za-z][\w:.-]*/.test(tag)) {
      offset = end + 1
      continue
    }

    const parent = stack.at(-1)
    const path = parent ? [...parent.path, parent.childCount++] : []
    elements.push({ path, start, end: end + 1 })

    if (!/\/\s*>$/.test(tag)) {
      stack.push({ path, childCount: 0 })
    }
    offset = end + 1
  }

  return elements
}

/** Returns a new SVG string with binding element IDs, retaining every native attribute and viewBox. */
export function decorateSvg(receipt: NativeRenderReceipt, bindingReceipt: SvgBindingReceipt): string {
  const openElementsByPath = new Map(svgOpenElements(receipt.svg).map(element => [pathKey(element.path), element]))
  const additions = Object.entries(bindingReceipt.elementPaths)
    .map(([elementId, path]) => ({ elementId, element: openElementsByPath.get(pathKey(path)) }))
    .filter((entry): entry is { elementId: string; element: OpenSvgElement } => Boolean(entry.element))
    .sort((left, right) => right.element.end - left.element.end)

  let decorated = receipt.svg

  for (const { elementId, element } of additions) {
    const openingTag = decorated.slice(element.start, element.end)
    if (/\sid\s*=/.test(openingTag)) continue
    const insertion = /\/\s*>$/.test(openingTag) ? element.start + openingTag.lastIndexOf("/") : element.end - 1
    decorated = `${decorated.slice(0, insertion)} id="${elementId}"${decorated.slice(insertion)}`
  }

  return decorated
}
