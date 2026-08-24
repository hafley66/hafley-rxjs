import { readFile } from "node:fs/promises"

import { chromium } from "playwright"
import { describe, expect, test } from "vitest"

import { bindD2Svg } from "../../d2/src/3_bindSvg.js"
import { identifyD2Occurrences } from "../../d2/src/2_identity.js"
import { parseD2Sequence } from "../../d2/src/1_parse.js"
import type { D2SequenceDocument } from "../../d2/src/0_types.js"
import { bindMermaidSvg } from "../../mmd/src/3_bindSvg.js"
import { identifyMermaidOccurrences } from "../../mmd/src/2_identity.js"
import { parseMermaidSequence } from "../../mmd/src/1_parse.js"
import type { MermaidSequenceDocument } from "../../mmd/src/0_types.js"
import {
  decorateSvg,
  type NativeRenderReceipt,
  type SvgBindingReceipt,
} from "../src/13_sequenceSvgBinding.js"
import { matchSequenceRevisions, type SequenceOccurrenceDocument } from "../src/12_sequenceIdentity.js"

const fixtureDirectory = new URL("../../../fixtures/sequence/", import.meta.url)

const files = {
  mermaid: {
    source: "0_mermaid.mmd",
    receipt: "7_mermaid.receipt.json",
    svg: "6_mermaid.svg",
    revisionSource: "4_mermaid.revision.mmd",
    revisionReceipt: "9_mermaid.revision.receipt.json",
    revisionSvg: "8_mermaid.revision.svg",
  },
  d2: {
    source: "2_d2.d2",
    receipt: "11_d2.receipt.json",
    svg: "10_d2.svg",
    revisionSource: "5_d2.revision.d2",
    revisionReceipt: "13_d2.revision.receipt.json",
    revisionSvg: "12_d2.revision.svg",
  },
} as const

async function nativeReceipt(language: keyof typeof files, revision = false): Promise<NativeRenderReceipt> {
  const file = files[language]
  const [metadata, svg] = await Promise.all([
    readFile(new URL(revision ? file.revisionReceipt : file.receipt, fixtureDirectory), "utf8"),
    readFile(new URL(revision ? file.revisionSvg : file.svg, fixtureDirectory), "utf8"),
  ])
  const parsed = JSON.parse(metadata) as Omit<NativeRenderReceipt, "svg">

  return { ...parsed, svg }
}

async function bindingCase(language: keyof typeof files, revision = false) {
  const source = await readFile(
    new URL(revision ? files[language].revisionSource : files[language].source, fixtureDirectory),
    "utf8",
  )
  const receipt = await nativeReceipt(language, revision)

  if (language === "mermaid") {
    const document = parseMermaidSequence(source)
    const occurrences = identifyMermaidOccurrences(document)
    return { document, occurrences, receipt, bindings: bindMermaidSvg(document, occurrences, receipt) }
  }

  const document = parseD2Sequence(source)
  const occurrences = identifyD2Occurrences(document)
  return { document, occurrences, receipt, bindings: bindD2Svg(document, occurrences, receipt) }
}

function bindingSummary(document: SequenceOccurrenceDocument, receipt: SvgBindingReceipt) {
  const occurrencesById = new Map(document.occurrences.map((occurrence) => [occurrence.id, occurrence]))

  return {
    bindings: receipt.bindings.map((binding) => ({
      occurrence: `${occurrencesById.get(binding.occurrenceId)?.kind}:${occurrencesById.get(binding.occurrenceId)?.label ?? ""}`,
      role: binding.role,
      ordinal: binding.ordinal,
      path: receipt.elementPaths[binding.elementId],
    })),
    unbound: receipt.unboundOccurrenceIds.map((id) => {
      const occurrence = occurrencesById.get(id)
      return `${occurrence?.kind}:${occurrence?.label ?? ""}`
    }),
    multiplyBound: receipt.multiplyBoundOccurrenceIds.length,
    unclaimedElementCount: receipt.unclaimedElementPaths.length,
  }
}

function rolesByOccurrence(receipt: SvgBindingReceipt) {
  const roles = new Map<string, string[]>()

  for (const binding of receipt.bindings) {
    const occurrenceRoles = roles.get(binding.occurrenceId) ?? []
    occurrenceRoles.push(`${binding.role}:${binding.ordinal}`)
    roles.set(binding.occurrenceId, occurrenceRoles)
  }

  for (const occurrenceRoles of roles.values()) occurrenceRoles.sort()
  return roles
}

async function validateDecoratedSvg(receipt: NativeRenderReceipt, bindings: SvgBindingReceipt) {
  const decorated = decorateSvg(receipt, bindings)
  const browser = await chromium.launch({ headless: true })

  try {
    const page = await browser.newPage()
    const validation = await page.evaluate((svg) => {
      const parsed = new DOMParser().parseFromString(svg, "image/svg+xml")
      const root = parsed.documentElement
      return {
        valid: !parsed.querySelector("parsererror"),
        viewBox: root.getAttribute("viewBox"),
        ids: [...root.querySelectorAll("[id]")].map((element) => element.id).sort(),
      }
    }, decorated)

    return { decorated, validation }
  } finally {
    await browser.close()
  }
}

describe("language-specific sequence SVG bindings", () => {
  test("associates group and note bindings by their source occurrence instead of a label lookup", async () => {
    const [mermaid, d2] = await Promise.all([bindingCase("mermaid"), bindingCase("d2")])
    const relabel = (occurrences: SequenceOccurrenceDocument) => ({
      ...occurrences,
      occurrences: occurrences.occurrences.map((occurrence) =>
        occurrence.kind === "group" || occurrence.kind === "note"
          ? { ...occurrence, label: `opaque ${occurrence.kind}` }
          : occurrence,
      ),
    })
    const mermaidRelabeled = relabel(mermaid.occurrences)
    const d2Relabeled = relabel(d2.occurrences)
    const results = [
      {
        bindings: bindMermaidSvg(
          mermaid.document as MermaidSequenceDocument,
          mermaidRelabeled,
          mermaid.receipt,
        ),
        occurrences: mermaidRelabeled,
      },
      {
        bindings: bindD2Svg(d2.document as D2SequenceDocument, d2Relabeled, d2.receipt),
        occurrences: d2Relabeled,
      },
    ]

    for (const result of results) {
      expect(
        result.bindings.unboundOccurrenceIds.filter((id) =>
          result.occurrences.occurrences.some(
            (occurrence) =>
              occurrence.id === id && (occurrence.kind === "group" || occurrence.kind === "note"),
          ),
        ),
      ).toEqual([])
    }
  })

  test("recovers all fixture roles and distinct repeated-message elements", async () => {
    const [mermaid, d2] = await Promise.all([bindingCase("mermaid"), bindingCase("d2")])

    expect({
      mermaid: bindingSummary(mermaid.occurrences, mermaid.bindings),
      d2: bindingSummary(d2.occurrences, d2.bindings),
    }).toMatchInlineSnapshot(`
      {
        "d2": {
          "bindings": [
            {
              "occurrence": "actor:Alice",
              "ordinal": 0,
              "path": [
                0,
                3,
                0,
              ],
              "role": "actor-shape",
            },
            {
              "occurrence": "actor:Alice",
              "ordinal": 0,
              "path": [
                0,
                3,
                1,
              ],
              "role": "actor-label",
            },
            {
              "occurrence": "actor:Alice",
              "ordinal": 0,
              "path": [
                0,
                6,
                0,
              ],
              "role": "lifeline",
            },
            {
              "occurrence": "actor:Bob",
              "ordinal": 0,
              "path": [
                0,
                4,
                0,
              ],
              "role": "actor-shape",
            },
            {
              "occurrence": "actor:Bob",
              "ordinal": 0,
              "path": [
                0,
                4,
                1,
              ],
              "role": "actor-label",
            },
            {
              "occurrence": "actor:Bob",
              "ordinal": 0,
              "path": [
                0,
                7,
                0,
              ],
              "role": "lifeline",
            },
            {
              "occurrence": "actor:Archive Service Far Right",
              "ordinal": 0,
              "path": [
                0,
                5,
                0,
              ],
              "role": "actor-shape",
            },
            {
              "occurrence": "actor:Archive Service Far Right",
              "ordinal": 0,
              "path": [
                0,
                5,
                1,
              ],
              "role": "actor-label",
            },
            {
              "occurrence": "actor:Archive Service Far Right",
              "ordinal": 0,
              "path": [
                0,
                8,
                0,
              ],
              "role": "lifeline",
            },
            {
              "occurrence": "message:repeat",
              "ordinal": 0,
              "path": [
                0,
                12,
                1,
              ],
              "role": "message-line",
            },
            {
              "occurrence": "message:repeat",
              "ordinal": 0,
              "path": [
                0,
                12,
                2,
              ],
              "role": "message-label",
            },
            {
              "occurrence": "message:inspect",
              "ordinal": 0,
              "path": [
                0,
                13,
                0,
              ],
              "role": "message-line",
            },
            {
              "occurrence": "message:inspect",
              "ordinal": 0,
              "path": [
                0,
                13,
                1,
              ],
              "role": "message-label",
            },
            {
              "occurrence": "message:repeat",
              "ordinal": 0,
              "path": [
                0,
                14,
                0,
              ],
              "role": "message-line",
            },
            {
              "occurrence": "message:repeat",
              "ordinal": 0,
              "path": [
                0,
                14,
                1,
              ],
              "role": "message-label",
            },
            {
              "occurrence": "message:archive",
              "ordinal": 0,
              "path": [
                0,
                15,
                0,
              ],
              "role": "message-line",
            },
            {
              "occurrence": "message:archive",
              "ordinal": 0,
              "path": [
                0,
                15,
                1,
              ],
              "role": "message-label",
            },
            {
              "occurrence": "group:outer exchange",
              "ordinal": 0,
              "path": [
                0,
                10,
                0,
              ],
              "role": "group-frame",
            },
            {
              "occurrence": "group:outer exchange",
              "ordinal": 0,
              "path": [
                0,
                10,
                2,
              ],
              "role": "group-label",
            },
            {
              "occurrence": "group:nested review",
              "ordinal": 0,
              "path": [
                0,
                11,
                0,
              ],
              "role": "group-frame",
            },
            {
              "occurrence": "group:nested review",
              "ordinal": 0,
              "path": [
                0,
                11,
                2,
              ],
              "role": "group-label",
            },
            {
              "occurrence": "activation:work",
              "ordinal": 0,
              "path": [
                0,
                9,
                0,
              ],
              "role": "activation",
            },
            {
              "occurrence": "note:local note",
              "ordinal": 0,
              "path": [
                0,
                16,
                0,
              ],
              "role": "note-shape",
            },
            {
              "occurrence": "note:local note",
              "ordinal": 0,
              "path": [
                0,
                16,
                1,
              ],
              "role": "note-label",
            },
          ],
          "multiplyBound": 0,
          "unbound": [],
          "unclaimedElementCount": 37,
        },
        "mermaid": {
          "bindings": [
            {
              "occurrence": "actor:Alice",
              "ordinal": 0,
              "path": [
                5,
                1,
                0,
              ],
              "role": "actor-shape",
            },
            {
              "occurrence": "actor:Alice",
              "ordinal": 0,
              "path": [
                5,
                1,
                1,
                0,
              ],
              "role": "actor-label",
            },
            {
              "occurrence": "actor:Alice",
              "ordinal": 0,
              "path": [
                2,
                0,
              ],
              "role": "actor-bottom-shape",
            },
            {
              "occurrence": "actor:Alice",
              "ordinal": 0,
              "path": [
                2,
                1,
                0,
              ],
              "role": "actor-bottom-label",
            },
            {
              "occurrence": "actor:Alice",
              "ordinal": 0,
              "path": [
                5,
                0,
              ],
              "role": "lifeline",
            },
            {
              "occurrence": "actor:Bob",
              "ordinal": 0,
              "path": [
                4,
                1,
                0,
              ],
              "role": "actor-shape",
            },
            {
              "occurrence": "actor:Bob",
              "ordinal": 0,
              "path": [
                4,
                1,
                1,
                0,
              ],
              "role": "actor-label",
            },
            {
              "occurrence": "actor:Bob",
              "ordinal": 0,
              "path": [
                1,
                0,
              ],
              "role": "actor-bottom-shape",
            },
            {
              "occurrence": "actor:Bob",
              "ordinal": 0,
              "path": [
                1,
                1,
                0,
              ],
              "role": "actor-bottom-label",
            },
            {
              "occurrence": "actor:Bob",
              "ordinal": 0,
              "path": [
                4,
                0,
              ],
              "role": "lifeline",
            },
            {
              "occurrence": "actor:Archive Service Far Right",
              "ordinal": 0,
              "path": [
                3,
                1,
                0,
              ],
              "role": "actor-shape",
            },
            {
              "occurrence": "actor:Archive Service Far Right",
              "ordinal": 0,
              "path": [
                3,
                1,
                1,
                0,
              ],
              "role": "actor-label",
            },
            {
              "occurrence": "actor:Archive Service Far Right",
              "ordinal": 0,
              "path": [
                0,
                0,
              ],
              "role": "actor-bottom-shape",
            },
            {
              "occurrence": "actor:Archive Service Far Right",
              "ordinal": 0,
              "path": [
                0,
                1,
                0,
              ],
              "role": "actor-bottom-label",
            },
            {
              "occurrence": "actor:Archive Service Far Right",
              "ordinal": 0,
              "path": [
                3,
                0,
              ],
              "role": "lifeline",
            },
            {
              "occurrence": "message:repeat",
              "ordinal": 0,
              "path": [
                24,
              ],
              "role": "message-line",
            },
            {
              "occurrence": "message:repeat",
              "ordinal": 0,
              "path": [
                23,
              ],
              "role": "message-label",
            },
            {
              "occurrence": "message:inspect",
              "ordinal": 0,
              "path": [
                26,
              ],
              "role": "message-line",
            },
            {
              "occurrence": "message:inspect",
              "ordinal": 0,
              "path": [
                25,
              ],
              "role": "message-label",
            },
            {
              "occurrence": "message:repeat",
              "ordinal": 0,
              "path": [
                28,
              ],
              "role": "message-line",
            },
            {
              "occurrence": "message:repeat",
              "ordinal": 0,
              "path": [
                27,
              ],
              "role": "message-label",
            },
            {
              "occurrence": "message:archive",
              "ordinal": 0,
              "path": [
                30,
              ],
              "role": "message-line",
            },
            {
              "occurrence": "message:archive",
              "ordinal": 0,
              "path": [
                29,
              ],
              "role": "message-label",
            },
            {
              "occurrence": "group:outer exchange",
              "ordinal": 0,
              "path": [
                22,
                0,
              ],
              "role": "group-frame",
            },
            {
              "occurrence": "group:outer exchange",
              "ordinal": 1,
              "path": [
                22,
                1,
              ],
              "role": "group-frame",
            },
            {
              "occurrence": "group:outer exchange",
              "ordinal": 2,
              "path": [
                22,
                2,
              ],
              "role": "group-frame",
            },
            {
              "occurrence": "group:outer exchange",
              "ordinal": 3,
              "path": [
                22,
                3,
              ],
              "role": "group-frame",
            },
            {
              "occurrence": "group:outer exchange",
              "ordinal": 0,
              "path": [
                22,
                6,
                0,
              ],
              "role": "group-label",
            },
            {
              "occurrence": "group:nested review",
              "ordinal": 0,
              "path": [
                21,
                0,
              ],
              "role": "group-frame",
            },
            {
              "occurrence": "group:nested review",
              "ordinal": 1,
              "path": [
                21,
                1,
              ],
              "role": "group-frame",
            },
            {
              "occurrence": "group:nested review",
              "ordinal": 2,
              "path": [
                21,
                2,
              ],
              "role": "group-frame",
            },
            {
              "occurrence": "group:nested review",
              "ordinal": 3,
              "path": [
                21,
                3,
              ],
              "role": "group-frame",
            },
            {
              "occurrence": "group:nested review",
              "ordinal": 0,
              "path": [
                21,
                6,
                0,
              ],
              "role": "group-label",
            },
            {
              "occurrence": "activation:activate",
              "ordinal": 0,
              "path": [
                19,
                0,
              ],
              "role": "activation",
            },
            {
              "occurrence": "note:local note",
              "ordinal": 0,
              "path": [
                20,
                0,
              ],
              "role": "note-shape",
            },
            {
              "occurrence": "note:local note",
              "ordinal": 0,
              "path": [
                20,
                1,
                0,
              ],
              "role": "note-label",
            },
          ],
          "multiplyBound": 0,
          "unbound": [
            "activation:deactivate",
          ],
          "unclaimedElementCount": 62,
        },
      }
    `)
  })

  test("decorates valid SVG copies while retaining native viewBoxes", async () => {
    const [mermaid, d2] = await Promise.all([bindingCase("mermaid"), bindingCase("d2")])
    const [mermaidSvg, d2Svg] = await Promise.all([
      validateDecoratedSvg(mermaid.receipt, mermaid.bindings),
      validateDecoratedSvg(d2.receipt, d2.bindings),
    ])

    expect({
      mermaid: {
        valid: mermaidSvg.validation.valid,
        originalViewBox: mermaid.receipt.elements[0].attributes.viewBox,
        decoratedViewBox: mermaidSvg.validation.viewBox,
        bindingIdsPresent: mermaid.bindings.bindings.every((binding) => mermaidSvg.validation.ids.includes(binding.elementId)),
      },
      d2: {
        valid: d2Svg.validation.valid,
        originalViewBox: d2.receipt.elements[0].attributes.viewBox,
        decoratedViewBox: d2Svg.validation.viewBox,
        bindingIdsPresent: d2.bindings.bindings.every((binding) => d2Svg.validation.ids.includes(binding.elementId)),
      },
    }).toMatchInlineSnapshot(`
      {
        "d2": {
          "bindingIdsPresent": true,
          "decoratedViewBox": "0 0 704 911",
          "originalViewBox": "0 0 704 911",
          "valid": true,
        },
        "mermaid": {
          "bindingIdsPresent": true,
          "decoratedViewBox": "-50 -10 701 534",
          "originalViewBox": "-50 -10 701 534",
          "valid": true,
        },
      }
    `)
  })

  test("keeps retained binding roles after insert-before and reports repeated-message ambiguity", async () => {
    const reports = []

    for (const language of ["mermaid", "d2"] as const) {
      const [base, revision] = await Promise.all([bindingCase(language), bindingCase(language, true)])
      const match = matchSequenceRevisions(base.occurrences.occurrences, revision.occurrences.occurrences)
      const baseByStructure = new Map(base.occurrences.occurrences.map((occurrence) => [occurrence.structuralKey, occurrence]))
      const baseRoles = rolesByOccurrence(base.bindings)
      const revisionRoles = rolesByOccurrence(revision.bindings)

      reports.push({
        language,
        ambiguities: match.ambiguities.map((ambiguity) => ambiguity.reason),
        blockedPlacementCount: match.placement.blockedOccurrenceIds.length,
        retainedRoles: match.retained.map((id) => {
          const next = revision.occurrences.occurrences.find((occurrence) => occurrence.id === id)
          const previous = next ? baseByStructure.get(next.structuralKey) : undefined
          return {
            kind: next?.kind,
            label: next?.label,
            sameRoles: previous
              ? JSON.stringify(baseRoles.get(previous.id)) === JSON.stringify(revisionRoles.get(id))
              : false,
          }
        }),
      })
    }

    expect(reports).toMatchInlineSnapshot(`
      [
        {
          "ambiguities": [
            "repeated-structure",
            "repeated-structure",
          ],
          "blockedPlacementCount": 2,
          "language": "mermaid",
          "retainedRoles": [
            {
              "kind": "actor",
              "label": "Alice",
              "sameRoles": true,
            },
            {
              "kind": "actor",
              "label": "Bob",
              "sameRoles": true,
            },
            {
              "kind": "actor",
              "label": "Archive Service Far Right",
              "sameRoles": true,
            },
            {
              "kind": "group",
              "label": "outer exchange",
              "sameRoles": true,
            },
            {
              "kind": "group",
              "label": "nested review",
              "sameRoles": true,
            },
            {
              "kind": "activation",
              "label": "activate",
              "sameRoles": true,
            },
            {
              "kind": "message",
              "label": "inspect",
              "sameRoles": true,
            },
            {
              "kind": "note",
              "label": "local note",
              "sameRoles": true,
            },
            {
              "kind": "activation",
              "label": "deactivate",
              "sameRoles": true,
            },
            {
              "kind": "message",
              "label": "archive",
              "sameRoles": true,
            },
          ],
        },
        {
          "ambiguities": [
            "repeated-structure",
            "repeated-structure",
          ],
          "blockedPlacementCount": 2,
          "language": "d2",
          "retainedRoles": [
            {
              "kind": "actor",
              "label": "Alice",
              "sameRoles": true,
            },
            {
              "kind": "actor",
              "label": "Bob",
              "sameRoles": true,
            },
            {
              "kind": "actor",
              "label": "Archive Service Far Right",
              "sameRoles": true,
            },
            {
              "kind": "activation",
              "label": "work",
              "sameRoles": true,
            },
            {
              "kind": "group",
              "label": "outer exchange",
              "sameRoles": true,
            },
            {
              "kind": "group",
              "label": "nested review",
              "sameRoles": true,
            },
            {
              "kind": "message",
              "label": "inspect",
              "sameRoles": true,
            },
            {
              "kind": "note",
              "label": "local note",
              "sameRoles": true,
            },
            {
              "kind": "message",
              "label": "archive",
              "sameRoles": true,
            },
          ],
        },
      ]
    `)
  })
})
