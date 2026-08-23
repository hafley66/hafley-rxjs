import { readFile } from "node:fs/promises"

import { describe, expect, test } from "vitest"

import {
  buildCheckedReceiptPair,
  sequenceReceiptFiles,
} from "./2_sequenceRenderReceipts.mjs"

const fixtureDirectory = new URL("../fixtures/sequence/", import.meta.url)

type ReceiptElement = {
  path: number[]
  tag: string
  id?: string
  classes: string[]
  text?: string
  attributes: Record<string, string>
}

type CheckedReceipt = {
  language: "mermaid" | "d2"
  rendererPackage: string
  rendererVersion: string
  sourceHash: string
  svgHash: string
  options: unknown
  svgFile: string
  elements: ReceiptElement[]
}

async function readCheckedReceipt(filename: string) {
  return JSON.parse(
    await readFile(new URL(filename, fixtureDirectory), "utf8"),
  ) as CheckedReceipt
}

function countText(receipt: CheckedReceipt, text: string) {
  return receipt.elements.filter((element) => element.text === text).length
}

function countTextContaining(receipt: CheckedReceipt, text: string) {
  return receipt.elements.filter((element) => element.text?.includes(text))
    .length
}

function countClass(receipt: CheckedReceipt, className: string) {
  return receipt.elements.filter((element) =>
    element.classes.includes(className),
  ).length
}

describe("native sequence renderer receipts", () => {
  test(
    "reproduces checked SVG bytes, structural receipts, and revision ID reports",
    async () => {
      const summaries = []

      for (const language of ["mermaid", "d2"] as const) {
        const files = sequenceReceiptFiles[language]
        const pair = await buildCheckedReceiptPair(language)
        const [checkedBase, checkedRevision, baseSvg, revisionSvg] =
          await Promise.all([
            readCheckedReceipt(files.receipt),
            readCheckedReceipt(files.revisionReceipt),
            readFile(new URL(files.svg, fixtureDirectory), "utf8"),
            readFile(new URL(files.revisionSvg, fixtureDirectory), "utf8"),
          ])

        summaries.push({
          language,
          renderer: `${pair.base.rendererPackage}@${pair.base.rendererVersion}`,
          sourceHash: pair.base.sourceHash,
          svgHash: pair.base.svgHash,
          revisionSourceHash: pair.revision.sourceHash,
          revisionSvgHash: pair.revision.svgHash,
          options: pair.base.options,
          elementCounts: [pair.base.elements.length, pair.revision.elements.length],
          checkedArtifacts: {
            baseSvg: pair.base.svg === baseSvg,
            revisionSvg: pair.revision.svg === revisionSvg,
            baseReceipt:
              JSON.stringify(pair.checkedBase) === JSON.stringify(checkedBase),
            revisionReceipt:
              JSON.stringify(pair.checkedRevision) ===
              JSON.stringify(checkedRevision),
          },
          evidence: {
            actors: ["Alice", "Bob", "Archive Service Far Right"].map(
              (text) => [text, countText(checkedBase, text)],
            ),
            messages: ["repeat", "inspect", "archive"].map((text) => [
              text,
              countText(checkedBase, text),
            ]),
            groups: ["outer exchange", "nested review"].map((text) => [
              text,
              countTextContaining(checkedBase, text),
            ]),
            note: countText(checkedBase, "local note"),
            activationOrSpan:
              language === "mermaid"
                ? countClass(checkedBase, "activation0")
                : countClass(checkedBase, "Ym9iLndvcms="),
          },
          stableNativeIds: pair.stableIds,
        })
      }

      expect(summaries).toMatchInlineSnapshot(`
        [
          {
            "checkedArtifacts": {
              "baseReceipt": true,
              "baseSvg": true,
              "revisionReceipt": true,
              "revisionSvg": true,
            },
            "elementCounts": [
              98,
              100,
            ],
            "evidence": {
              "activationOrSpan": 1,
              "actors": [
                [
                  "Alice",
                  2,
                ],
                [
                  "Bob",
                  2,
                ],
                [
                  "Archive Service Far Right",
                  2,
                ],
              ],
              "groups": [
                [
                  "outer exchange",
                  1,
                ],
                [
                  "nested review",
                  1,
                ],
              ],
              "messages": [
                [
                  "repeat",
                  2,
                ],
                [
                  "inspect",
                  1,
                ],
                [
                  "archive",
                  1,
                ],
              ],
              "note": 1,
            },
            "language": "mermaid",
            "options": {
              "deterministicIDSeed": "hafley-sequence-renderer-smoke",
              "deterministicIds": true,
              "fontFamily": "Arial",
              "securityLevel": "strict",
              "sequence": {
                "useMaxWidth": false,
              },
              "startOnLoad": false,
              "theme": "base",
            },
            "renderer": "mermaid@11.16.0",
            "revisionSourceHash": "a2a0363244e3c279b5e0bef0ec10881d1dd3ddd473d74a8650df5aa1e62df3bc",
            "revisionSvgHash": "5edca81f160706c5b78f76deb23cacd99be63d945d4294ad1ffd7daabdd19104",
            "sourceHash": "7e1b81af733dd22f8fcfeea87c9924cf704daf203caf8d3a835af17a2198cf73",
            "stableNativeIds": [
              "sequence-renderer-smoke",
              "actor2",
              "root-2",
              "actor1",
              "root-1",
              "actor0",
              "root-0",
              "sequence-renderer-smoke-computer",
              "sequence-renderer-smoke-database",
              "sequence-renderer-smoke-clock",
              "sequence-renderer-smoke-arrowhead",
              "sequence-renderer-smoke-crosshead",
              "sequence-renderer-smoke-filled-head",
              "sequence-renderer-smoke-sequencenumber",
              "sequence-renderer-smoke-solidTopArrowHead",
              "sequence-renderer-smoke-solidBottomArrowHead",
              "sequence-renderer-smoke-stickTopArrowHead",
              "sequence-renderer-smoke-stickBottomArrowHead",
            ],
            "svgHash": "7c4f797587eec4e77f3e192a85fe2d4d6c8473c2e9daee5f7bd25894ee8cbf58",
          },
          {
            "checkedArtifacts": {
              "baseReceipt": true,
              "baseSvg": true,
              "revisionReceipt": true,
              "revisionSvg": true,
            },
            "elementCounts": [
              61,
              65,
            ],
            "evidence": {
              "activationOrSpan": 1,
              "actors": [
                [
                  "Alice",
                  1,
                ],
                [
                  "Bob",
                  1,
                ],
                [
                  "Archive Service Far Right",
                  1,
                ],
              ],
              "groups": [
                [
                  "outer exchange",
                  1,
                ],
                [
                  "nested review",
                  1,
                ],
              ],
              "messages": [
                [
                  "repeat",
                  2,
                ],
                [
                  "inspect",
                  1,
                ],
                [
                  "archive",
                  1,
                ],
              ],
              "note": 1,
            },
            "language": "d2",
            "options": [
              "--watch=false",
              "--theme=0",
              "--layout=dagre",
              "--pad=100",
              "--scale=1",
            ],
            "renderer": "d2@0.7.1",
            "revisionSourceHash": "1fe1ce78b143b05655771337756ed55678abf13489d754afb84d1da732edba81",
            "revisionSvgHash": "cc366be08a9614c5e9ae2576e8e7b2a13c331beb3b29019b6891e99544bc4c83",
            "sourceHash": "06c71f28d17d9171876ddf4ab3b310214d3afb0cd5a11dd9604f16831c2e4e12",
            "stableNativeIds": [],
            "svgHash": "d41a5cc8cafd095b6bc01ee84443f3903b3626dd56134f37e8343a870e5d2400",
          },
        ]
      `)
    },
    120_000,
  )
})
