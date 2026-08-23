import { readFile } from "node:fs/promises"

import { describe, expect, test } from "vitest"

import { identifyD2Occurrences } from "../../d2/src/2_identity.js"
import { parseD2Sequence } from "../../d2/src/1_parse.js"
import { identifyMermaidOccurrences } from "../../mmd/src/2_identity.js"
import { parseMermaidSequence } from "../../mmd/src/1_parse.js"
import {
  matchSequenceRevisions,
  validateSequenceRelations,
} from "../src/12_sequenceIdentity.js"

const fixtureDirectory = new URL("../../../fixtures/sequence/", import.meta.url)

const revisionFiles = {
  mermaid: [
    "14_mermaid.a.mmd",
    "15_mermaid.b.mmd",
    "16_mermaid.c.mmd",
    "17_mermaid.d.mmd",
    "18_mermaid.e.mmd",
    "19_mermaid.f.mmd",
  ],
  d2: [
    "20_d2.a.d2",
    "21_d2.b.d2",
    "22_d2.c.d2",
    "23_d2.d.d2",
    "24_d2.e.d2",
    "25_d2.f.d2",
  ],
} as const

async function loadRevisions(language: keyof typeof revisionFiles) {
  const sources = await Promise.all(
    revisionFiles[language].map((filename) =>
      readFile(new URL(filename, fixtureDirectory), "utf8"),
    ),
  )
  if (language === "mermaid") {
    return sources.map(source => identifyMermaidOccurrences(parseMermaidSequence(source)))
  }

  return sources.map(source => identifyD2Occurrences(parseD2Sequence(source)))
}

describe("sequence occurrence identity", () => {
  test("records all six Mermaid revision receipts and blocks ambiguous placement transfer", async () => {
    const revisions = await loadRevisions("mermaid")
    const receipts = revisions.map((revision, index) => ({
      revision: String.fromCharCode(65 + index),
      validation: validateSequenceRelations(revision),
      matchFromA:
        index === 0 ? undefined : matchSequenceRevisions(revisions[0].occurrences, revision.occurrences),
    }))

    expect(receipts).toMatchInlineSnapshot(`
      [
        {
          "matchFromA": undefined,
          "revision": "A",
          "validation": {
            "diagnostics": [],
            "valid": true,
          },
        },
        {
          "matchFromA": {
            "ambiguities": [
              {
                "candidatePreviousIds": [
                  "mermaid:092e83e2:message:alice->>bob:repeat#2",
                  "mermaid:092e83e2:message:alice->>bob:repeat#6",
                ],
                "nextOccurrenceId": "mermaid:2f7daa1f:message:alice->>bob:repeat#3",
                "reason": "repeated-structure",
              },
              {
                "candidatePreviousIds": [
                  "mermaid:092e83e2:message:alice->>bob:repeat#2",
                  "mermaid:092e83e2:message:alice->>bob:repeat#6",
                ],
                "nextOccurrenceId": "mermaid:2f7daa1f:message:alice->>bob:repeat#7",
                "reason": "repeated-structure",
              },
            ],
            "inserted": [
              "mermaid:2f7daa1f:message:alice->>archive:preface#0",
              "mermaid:2f7daa1f:message:alice->>bob:repeat#3",
              "mermaid:2f7daa1f:message:alice->>bob:repeat#7",
            ],
            "placement": {
              "blockedOccurrenceIds": [
                "mermaid:2f7daa1f:message:alice->>bob:repeat#3",
                "mermaid:2f7daa1f:message:alice->>bob:repeat#7",
              ],
              "transferableOccurrenceIds": [
                "mermaid:2f7daa1f:participant:alice#0",
                "mermaid:2f7daa1f:participant:bob#1",
                "mermaid:2f7daa1f:participant:archive#2",
                "mermaid:2f7daa1f:group:loop:outer exchange#1",
                "mermaid:2f7daa1f:group:alt:nested review#2",
                "mermaid:2f7daa1f:activation:activate:bob#4",
                "mermaid:2f7daa1f:message:bob->>bob:inspect#5",
                "mermaid:2f7daa1f:note:right of:bob:local note#6",
                "mermaid:2f7daa1f:activation:deactivate:bob#8",
                "mermaid:2f7daa1f:message:bob->>archive:archive#9",
              ],
            },
            "removed": [
              "mermaid:092e83e2:message:alice->>bob:repeat#2",
              "mermaid:092e83e2:message:alice->>bob:repeat#6",
            ],
            "retained": [
              "mermaid:2f7daa1f:participant:alice#0",
              "mermaid:2f7daa1f:participant:bob#1",
              "mermaid:2f7daa1f:participant:archive#2",
              "mermaid:2f7daa1f:group:loop:outer exchange#1",
              "mermaid:2f7daa1f:group:alt:nested review#2",
              "mermaid:2f7daa1f:activation:activate:bob#4",
              "mermaid:2f7daa1f:message:bob->>bob:inspect#5",
              "mermaid:2f7daa1f:note:right of:bob:local note#6",
              "mermaid:2f7daa1f:activation:deactivate:bob#8",
              "mermaid:2f7daa1f:message:bob->>archive:archive#9",
            ],
          },
          "revision": "B",
          "validation": {
            "diagnostics": [],
            "valid": true,
          },
        },
        {
          "matchFromA": {
            "ambiguities": [
              {
                "candidatePreviousIds": [
                  "mermaid:092e83e2:message:alice->>bob:repeat#2",
                  "mermaid:092e83e2:message:alice->>bob:repeat#6",
                ],
                "nextOccurrenceId": "mermaid:5b318670:message:alice->>bob:repeat#2",
                "reason": "reordered-structure",
              },
              {
                "candidatePreviousIds": [
                  "mermaid:092e83e2:message:alice->>bob:repeat#2",
                  "mermaid:092e83e2:message:alice->>bob:repeat#6",
                ],
                "nextOccurrenceId": "mermaid:5b318670:message:alice->>bob:repeat#4",
                "reason": "reordered-structure",
              },
            ],
            "inserted": [
              "mermaid:5b318670:message:alice->>bob:repeat#2",
              "mermaid:5b318670:message:alice->>bob:repeat#4",
            ],
            "placement": {
              "blockedOccurrenceIds": [
                "mermaid:5b318670:message:alice->>bob:repeat#2",
                "mermaid:5b318670:message:alice->>bob:repeat#4",
              ],
              "transferableOccurrenceIds": [
                "mermaid:5b318670:participant:alice#0",
                "mermaid:5b318670:participant:bob#1",
                "mermaid:5b318670:participant:archive#2",
                "mermaid:5b318670:group:loop:outer exchange#0",
                "mermaid:5b318670:group:alt:nested review#1",
                "mermaid:5b318670:activation:activate:bob#3",
                "mermaid:5b318670:message:bob->>bob:inspect#5",
                "mermaid:5b318670:note:right of:bob:local note#6",
                "mermaid:5b318670:activation:deactivate:bob#7",
                "mermaid:5b318670:message:bob->>archive:archive#8",
              ],
            },
            "removed": [
              "mermaid:092e83e2:message:alice->>bob:repeat#2",
              "mermaid:092e83e2:message:alice->>bob:repeat#6",
            ],
            "retained": [
              "mermaid:5b318670:participant:alice#0",
              "mermaid:5b318670:participant:bob#1",
              "mermaid:5b318670:participant:archive#2",
              "mermaid:5b318670:group:loop:outer exchange#0",
              "mermaid:5b318670:group:alt:nested review#1",
              "mermaid:5b318670:activation:activate:bob#3",
              "mermaid:5b318670:message:bob->>bob:inspect#5",
              "mermaid:5b318670:note:right of:bob:local note#6",
              "mermaid:5b318670:activation:deactivate:bob#7",
              "mermaid:5b318670:message:bob->>archive:archive#8",
            ],
          },
          "revision": "C",
          "validation": {
            "diagnostics": [],
            "valid": true,
          },
        },
        {
          "matchFromA": {
            "ambiguities": [
              {
                "candidatePreviousIds": [
                  "mermaid:092e83e2:message:alice->>bob:repeat#2",
                  "mermaid:092e83e2:message:alice->>bob:repeat#6",
                ],
                "nextOccurrenceId": "mermaid:95469281:message:alice->>bob:repeat#6",
                "reason": "repeated-structure",
              },
            ],
            "inserted": [
              "mermaid:95469281:message:alice->>bob:repeat renamed#2",
              "mermaid:95469281:message:alice->>bob:repeat#6",
            ],
            "placement": {
              "blockedOccurrenceIds": [
                "mermaid:95469281:message:alice->>bob:repeat#6",
              ],
              "transferableOccurrenceIds": [
                "mermaid:95469281:participant:alice#0",
                "mermaid:95469281:participant:bob#1",
                "mermaid:95469281:participant:archive#2",
                "mermaid:95469281:group:loop:outer exchange#0",
                "mermaid:95469281:group:alt:nested review#1",
                "mermaid:95469281:activation:activate:bob#3",
                "mermaid:95469281:message:bob->>bob:inspect#4",
                "mermaid:95469281:note:right of:bob:local note#5",
                "mermaid:95469281:activation:deactivate:bob#7",
                "mermaid:95469281:message:bob->>archive:archive#8",
              ],
            },
            "removed": [
              "mermaid:092e83e2:message:alice->>bob:repeat#2",
              "mermaid:092e83e2:message:alice->>bob:repeat#6",
            ],
            "retained": [
              "mermaid:95469281:participant:alice#0",
              "mermaid:95469281:participant:bob#1",
              "mermaid:95469281:participant:archive#2",
              "mermaid:95469281:group:loop:outer exchange#0",
              "mermaid:95469281:group:alt:nested review#1",
              "mermaid:95469281:activation:activate:bob#3",
              "mermaid:95469281:message:bob->>bob:inspect#4",
              "mermaid:95469281:note:right of:bob:local note#5",
              "mermaid:95469281:activation:deactivate:bob#7",
              "mermaid:95469281:message:bob->>archive:archive#8",
            ],
          },
          "revision": "D",
          "validation": {
            "diagnostics": [],
            "valid": true,
          },
        },
        {
          "matchFromA": {
            "ambiguities": [
              {
                "candidatePreviousIds": [
                  "mermaid:092e83e2:message:alice->>bob:repeat#2",
                  "mermaid:092e83e2:message:alice->>bob:repeat#6",
                ],
                "nextOccurrenceId": "mermaid:b11a8058:message:alice->>bob:repeat#2",
                "reason": "repeated-structure",
              },
              {
                "candidatePreviousIds": [
                  "mermaid:092e83e2:message:alice->>bob:repeat#2",
                  "mermaid:092e83e2:message:alice->>bob:repeat#6",
                ],
                "nextOccurrenceId": "mermaid:b11a8058:message:alice->>bob:repeat#6",
                "reason": "repeated-structure",
              },
            ],
            "inserted": [
              "mermaid:b11a8058:message:alice->>bob:repeat#2",
              "mermaid:b11a8058:message:alice->>bob:repeat#6",
              "mermaid:b11a8058:message:bob->>archive:archive#8",
            ],
            "placement": {
              "blockedOccurrenceIds": [
                "mermaid:b11a8058:message:alice->>bob:repeat#2",
                "mermaid:b11a8058:message:alice->>bob:repeat#6",
              ],
              "transferableOccurrenceIds": [
                "mermaid:b11a8058:participant:alice#0",
                "mermaid:b11a8058:participant:bob#1",
                "mermaid:b11a8058:participant:archive#2",
                "mermaid:b11a8058:group:loop:outer exchange#0",
                "mermaid:b11a8058:group:alt:nested review#1",
                "mermaid:b11a8058:activation:activate:bob#3",
                "mermaid:b11a8058:message:bob->>bob:inspect#4",
                "mermaid:b11a8058:note:right of:bob:local note#5",
                "mermaid:b11a8058:activation:deactivate:bob#7",
              ],
            },
            "removed": [
              "mermaid:092e83e2:message:alice->>bob:repeat#2",
              "mermaid:092e83e2:message:alice->>bob:repeat#6",
              "mermaid:092e83e2:message:bob->>archive:archive#8",
            ],
            "retained": [
              "mermaid:b11a8058:participant:alice#0",
              "mermaid:b11a8058:participant:bob#1",
              "mermaid:b11a8058:participant:archive#2",
              "mermaid:b11a8058:group:loop:outer exchange#0",
              "mermaid:b11a8058:group:alt:nested review#1",
              "mermaid:b11a8058:activation:activate:bob#3",
              "mermaid:b11a8058:message:bob->>bob:inspect#4",
              "mermaid:b11a8058:note:right of:bob:local note#5",
              "mermaid:b11a8058:activation:deactivate:bob#7",
            ],
          },
          "revision": "E",
          "validation": {
            "diagnostics": [],
            "valid": true,
          },
        },
        {
          "matchFromA": {
            "ambiguities": [
              {
                "candidatePreviousIds": [
                  "mermaid:092e83e2:message:alice->>bob:repeat#2",
                  "mermaid:092e83e2:message:alice->>bob:repeat#6",
                ],
                "nextOccurrenceId": "mermaid:e75cdc5b:message:alice->>bob:repeat#5",
                "reason": "repeated-structure",
              },
            ],
            "inserted": [
              "mermaid:e75cdc5b:message:alice->>bob:repeat#5",
            ],
            "placement": {
              "blockedOccurrenceIds": [
                "mermaid:e75cdc5b:message:alice->>bob:repeat#5",
              ],
              "transferableOccurrenceIds": [
                "mermaid:e75cdc5b:participant:alice#0",
                "mermaid:e75cdc5b:participant:bob#1",
                "mermaid:e75cdc5b:participant:archive#2",
                "mermaid:e75cdc5b:group:loop:outer exchange#0",
                "mermaid:e75cdc5b:group:alt:nested review#1",
                "mermaid:e75cdc5b:activation:activate:bob#2",
                "mermaid:e75cdc5b:message:bob->>bob:inspect#3",
                "mermaid:e75cdc5b:note:right of:bob:local note#4",
                "mermaid:e75cdc5b:activation:deactivate:bob#6",
                "mermaid:e75cdc5b:message:bob->>archive:archive#7",
              ],
            },
            "removed": [
              "mermaid:092e83e2:message:alice->>bob:repeat#2",
              "mermaid:092e83e2:message:alice->>bob:repeat#6",
            ],
            "retained": [
              "mermaid:e75cdc5b:participant:alice#0",
              "mermaid:e75cdc5b:participant:bob#1",
              "mermaid:e75cdc5b:participant:archive#2",
              "mermaid:e75cdc5b:group:loop:outer exchange#0",
              "mermaid:e75cdc5b:group:alt:nested review#1",
              "mermaid:e75cdc5b:activation:activate:bob#2",
              "mermaid:e75cdc5b:message:bob->>bob:inspect#3",
              "mermaid:e75cdc5b:note:right of:bob:local note#4",
              "mermaid:e75cdc5b:activation:deactivate:bob#6",
              "mermaid:e75cdc5b:message:bob->>archive:archive#7",
            ],
          },
          "revision": "F",
          "validation": {
            "diagnostics": [],
            "valid": true,
          },
        },
      ]
    `)
  })

  test("records all six D2 revision receipts and keeps authored identities stable", async () => {
    const revisions = await loadRevisions("d2")
    const receipts = revisions.map((revision, index) => ({
      revision: String.fromCharCode(65 + index),
      validation: validateSequenceRelations(revision),
      matchFromA:
        index === 0 ? undefined : matchSequenceRevisions(revisions[0].occurrences, revision.occurrences),
    }))

    expect({
      receipts,
      stableAuthoredIds: revisions[0].occurrences
        .filter((occurrence) => occurrence.authoredId)
        .map((occurrence) => occurrence.authoredId)
        .filter((id) => revisions[1].occurrences.some((occurrence) => occurrence.authoredId === id)),
    }).toMatchInlineSnapshot(`
      {
        "receipts": [
          {
            "matchFromA": undefined,
            "revision": "A",
            "validation": {
              "diagnostics": [],
              "valid": true,
            },
          },
          {
            "matchFromA": {
              "ambiguities": [
                {
                  "candidatePreviousIds": [
                    "d2:49a15df1:edge:alice->bob.work:repeat#3",
                    "d2:49a15df1:edge:alice->bob.work:repeat#6",
                  ],
                  "nextOccurrenceId": "d2:4151db90:edge:alice->bob.work:repeat#4",
                  "reason": "repeated-structure",
                },
                {
                  "candidatePreviousIds": [
                    "d2:49a15df1:edge:alice->bob.work:repeat#3",
                    "d2:49a15df1:edge:alice->bob.work:repeat#6",
                  ],
                  "nextOccurrenceId": "d2:4151db90:edge:alice->bob.work:repeat#7",
                  "reason": "repeated-structure",
                },
              ],
              "inserted": [
                "d2:4151db90:edge:alice->archive:preface#1",
                "d2:4151db90:edge:alice->bob.work:repeat#4",
                "d2:4151db90:edge:alice->bob.work:repeat#7",
              ],
              "placement": {
                "blockedOccurrenceIds": [
                  "d2:4151db90:edge:alice->bob.work:repeat#4",
                  "d2:4151db90:edge:alice->bob.work:repeat#7",
                ],
                "transferableOccurrenceIds": [
                  "d2:4151db90:actor:alice#0",
                  "d2:4151db90:actor:bob#1",
                  "d2:4151db90:actor:archive#2",
                  "d2:4151db90:span:bob.work#0",
                  "d2:4151db90:group:outer exchange#0",
                  "d2:4151db90:group:nested review#1",
                  "d2:4151db90:edge:bob.work->bob.work:inspect#5",
                  "d2:4151db90:note:bob:local note#6",
                  "d2:4151db90:edge:bob->archive:archive#8",
                ],
              },
              "removed": [
                "d2:49a15df1:edge:alice->bob.work:repeat#3",
                "d2:49a15df1:edge:alice->bob.work:repeat#6",
              ],
              "retained": [
                "d2:4151db90:actor:alice#0",
                "d2:4151db90:actor:bob#1",
                "d2:4151db90:actor:archive#2",
                "d2:4151db90:span:bob.work#0",
                "d2:4151db90:group:outer exchange#0",
                "d2:4151db90:group:nested review#1",
                "d2:4151db90:edge:bob.work->bob.work:inspect#5",
                "d2:4151db90:note:bob:local note#6",
                "d2:4151db90:edge:bob->archive:archive#8",
              ],
            },
            "revision": "B",
            "validation": {
              "diagnostics": [],
              "valid": true,
            },
          },
          {
            "matchFromA": {
              "ambiguities": [
                {
                  "candidatePreviousIds": [
                    "d2:49a15df1:edge:alice->bob.work:repeat#3",
                    "d2:49a15df1:edge:alice->bob.work:repeat#6",
                  ],
                  "nextOccurrenceId": "d2:d9e6edcf:edge:alice->bob.work:repeat#3",
                  "reason": "reordered-structure",
                },
                {
                  "candidatePreviousIds": [
                    "d2:49a15df1:edge:alice->bob.work:repeat#3",
                    "d2:49a15df1:edge:alice->bob.work:repeat#6",
                  ],
                  "nextOccurrenceId": "d2:d9e6edcf:edge:alice->bob.work:repeat#4",
                  "reason": "reordered-structure",
                },
              ],
              "inserted": [
                "d2:d9e6edcf:edge:alice->bob.work:repeat#3",
                "d2:d9e6edcf:edge:alice->bob.work:repeat#4",
              ],
              "placement": {
                "blockedOccurrenceIds": [
                  "d2:d9e6edcf:edge:alice->bob.work:repeat#3",
                  "d2:d9e6edcf:edge:alice->bob.work:repeat#4",
                ],
                "transferableOccurrenceIds": [
                  "d2:d9e6edcf:actor:alice#0",
                  "d2:d9e6edcf:actor:bob#1",
                  "d2:d9e6edcf:actor:archive#2",
                  "d2:d9e6edcf:span:bob.work#0",
                  "d2:d9e6edcf:group:outer exchange#0",
                  "d2:d9e6edcf:group:nested review#1",
                  "d2:d9e6edcf:edge:bob.work->bob.work:inspect#5",
                  "d2:d9e6edcf:note:bob:local note#6",
                  "d2:d9e6edcf:edge:bob->archive:archive#7",
                ],
              },
              "removed": [
                "d2:49a15df1:edge:alice->bob.work:repeat#3",
                "d2:49a15df1:edge:alice->bob.work:repeat#6",
              ],
              "retained": [
                "d2:d9e6edcf:actor:alice#0",
                "d2:d9e6edcf:actor:bob#1",
                "d2:d9e6edcf:actor:archive#2",
                "d2:d9e6edcf:span:bob.work#0",
                "d2:d9e6edcf:group:outer exchange#0",
                "d2:d9e6edcf:group:nested review#1",
                "d2:d9e6edcf:edge:bob.work->bob.work:inspect#5",
                "d2:d9e6edcf:note:bob:local note#6",
                "d2:d9e6edcf:edge:bob->archive:archive#7",
              ],
            },
            "revision": "C",
            "validation": {
              "diagnostics": [],
              "valid": true,
            },
          },
          {
            "matchFromA": {
              "ambiguities": [
                {
                  "candidatePreviousIds": [
                    "d2:49a15df1:edge:alice->bob.work:repeat#3",
                    "d2:49a15df1:edge:alice->bob.work:repeat#6",
                  ],
                  "nextOccurrenceId": "d2:4bad4e40:edge:alice->bob.work:repeat#6",
                  "reason": "repeated-structure",
                },
              ],
              "inserted": [
                "d2:4bad4e40:edge:alice->bob.work:repeat renamed#3",
                "d2:4bad4e40:edge:alice->bob.work:repeat#6",
              ],
              "placement": {
                "blockedOccurrenceIds": [
                  "d2:4bad4e40:edge:alice->bob.work:repeat#6",
                ],
                "transferableOccurrenceIds": [
                  "d2:4bad4e40:actor:alice#0",
                  "d2:4bad4e40:actor:bob#1",
                  "d2:4bad4e40:actor:archive#2",
                  "d2:4bad4e40:span:bob.work#0",
                  "d2:4bad4e40:group:outer exchange#0",
                  "d2:4bad4e40:group:nested review#1",
                  "d2:4bad4e40:edge:bob.work->bob.work:inspect#4",
                  "d2:4bad4e40:note:bob:local note#5",
                  "d2:4bad4e40:edge:bob->archive:archive#7",
                ],
              },
              "removed": [
                "d2:49a15df1:edge:alice->bob.work:repeat#3",
                "d2:49a15df1:edge:alice->bob.work:repeat#6",
              ],
              "retained": [
                "d2:4bad4e40:actor:alice#0",
                "d2:4bad4e40:actor:bob#1",
                "d2:4bad4e40:actor:archive#2",
                "d2:4bad4e40:span:bob.work#0",
                "d2:4bad4e40:group:outer exchange#0",
                "d2:4bad4e40:group:nested review#1",
                "d2:4bad4e40:edge:bob.work->bob.work:inspect#4",
                "d2:4bad4e40:note:bob:local note#5",
                "d2:4bad4e40:edge:bob->archive:archive#7",
              ],
            },
            "revision": "D",
            "validation": {
              "diagnostics": [],
              "valid": true,
            },
          },
          {
            "matchFromA": {
              "ambiguities": [
                {
                  "candidatePreviousIds": [
                    "d2:49a15df1:edge:alice->bob.work:repeat#3",
                    "d2:49a15df1:edge:alice->bob.work:repeat#6",
                  ],
                  "nextOccurrenceId": "d2:d8567141:edge:alice->bob.work:repeat#3",
                  "reason": "repeated-structure",
                },
                {
                  "candidatePreviousIds": [
                    "d2:49a15df1:edge:alice->bob.work:repeat#3",
                    "d2:49a15df1:edge:alice->bob.work:repeat#6",
                  ],
                  "nextOccurrenceId": "d2:d8567141:edge:alice->bob.work:repeat#6",
                  "reason": "repeated-structure",
                },
              ],
              "inserted": [
                "d2:d8567141:edge:alice->bob.work:repeat#3",
                "d2:d8567141:edge:alice->bob.work:repeat#6",
                "d2:d8567141:edge:bob->archive:archive#7",
              ],
              "placement": {
                "blockedOccurrenceIds": [
                  "d2:d8567141:edge:alice->bob.work:repeat#3",
                  "d2:d8567141:edge:alice->bob.work:repeat#6",
                ],
                "transferableOccurrenceIds": [
                  "d2:d8567141:actor:alice#0",
                  "d2:d8567141:actor:bob#1",
                  "d2:d8567141:actor:archive#2",
                  "d2:d8567141:span:bob.work#0",
                  "d2:d8567141:group:outer exchange#0",
                  "d2:d8567141:group:nested review#1",
                  "d2:d8567141:edge:bob.work->bob.work:inspect#4",
                  "d2:d8567141:note:bob:local note#5",
                ],
              },
              "removed": [
                "d2:49a15df1:edge:alice->bob.work:repeat#3",
                "d2:49a15df1:edge:alice->bob.work:repeat#6",
                "d2:49a15df1:edge:bob->archive:archive#7",
              ],
              "retained": [
                "d2:d8567141:actor:alice#0",
                "d2:d8567141:actor:bob#1",
                "d2:d8567141:actor:archive#2",
                "d2:d8567141:span:bob.work#0",
                "d2:d8567141:group:outer exchange#0",
                "d2:d8567141:group:nested review#1",
                "d2:d8567141:edge:bob.work->bob.work:inspect#4",
                "d2:d8567141:note:bob:local note#5",
              ],
            },
            "revision": "E",
            "validation": {
              "diagnostics": [],
              "valid": true,
            },
          },
          {
            "matchFromA": {
              "ambiguities": [
                {
                  "candidatePreviousIds": [
                    "d2:49a15df1:edge:alice->bob.work:repeat#3",
                    "d2:49a15df1:edge:alice->bob.work:repeat#6",
                  ],
                  "nextOccurrenceId": "d2:dc947cd8:edge:alice->bob.work:repeat#5",
                  "reason": "repeated-structure",
                },
              ],
              "inserted": [
                "d2:dc947cd8:edge:alice->bob.work:repeat#5",
              ],
              "placement": {
                "blockedOccurrenceIds": [
                  "d2:dc947cd8:edge:alice->bob.work:repeat#5",
                ],
                "transferableOccurrenceIds": [
                  "d2:dc947cd8:actor:alice#0",
                  "d2:dc947cd8:actor:bob#1",
                  "d2:dc947cd8:actor:archive#2",
                  "d2:dc947cd8:span:bob.work#0",
                  "d2:dc947cd8:group:outer exchange#0",
                  "d2:dc947cd8:group:nested review#1",
                  "d2:dc947cd8:edge:bob.work->bob.work:inspect#3",
                  "d2:dc947cd8:note:bob:local note#4",
                  "d2:dc947cd8:edge:bob->archive:archive#6",
                ],
              },
              "removed": [
                "d2:49a15df1:edge:alice->bob.work:repeat#3",
                "d2:49a15df1:edge:alice->bob.work:repeat#6",
              ],
              "retained": [
                "d2:dc947cd8:actor:alice#0",
                "d2:dc947cd8:actor:bob#1",
                "d2:dc947cd8:actor:archive#2",
                "d2:dc947cd8:span:bob.work#0",
                "d2:dc947cd8:group:outer exchange#0",
                "d2:dc947cd8:group:nested review#1",
                "d2:dc947cd8:edge:bob.work->bob.work:inspect#3",
                "d2:dc947cd8:note:bob:local note#4",
                "d2:dc947cd8:edge:bob->archive:archive#6",
              ],
            },
            "revision": "F",
            "validation": {
              "diagnostics": [],
              "valid": true,
            },
          },
        ],
        "stableAuthoredIds": [
          "alice",
          "bob",
          "archive",
          "bob.work",
        ],
      }
    `)
  })

  test("returns the same receipts across repeated runs", async () => {
    const revisions = await loadRevisions("mermaid")
    const runs = Array.from({ length: 3 }, () =>
      revisions
        .slice(1)
        .map((revision) => matchSequenceRevisions(revisions[0].occurrences, revision.occurrences)),
    )

    expect(runs[0]).toEqual(runs[1])
    expect(runs[1]).toEqual(runs[2])
  })

  test("reports relation endpoints outside the occurrence revision", async () => {
    const [revision] = await loadRevisions("mermaid")

    expect(
      validateSequenceRelations({
        ...revision,
        relations: [
          ...revision.relations,
          {
            id: "fixture-invalid-relation",
            kind: "contains",
            sourceId: revision.occurrences[0].id,
            targetId: "missing-occurrence",
            ordinal: revision.relations.length,
          },
        ],
      }),
    ).toMatchInlineSnapshot(`
      {
        "diagnostics": [
          {
            "code": "SEQUENCE_MISSING_RELATION_ENDPOINT",
            "message": "relation fixture-invalid-relation references missing occurrence: missing-occurrence",
          },
        ],
        "valid": false,
      }
    `)
  })
})
