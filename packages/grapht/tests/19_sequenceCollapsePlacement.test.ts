import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { describe, expect, test } from "vitest"
import { d2SequenceAdapter } from "../../d2/src/index.js"
import { mermaidSequenceAdapter } from "../../mmd/src/index.js"
import {
  buildSequenceArtifact,
  matchSequenceRevisions,
  measureSequenceSvg,
  projectCollapsedSequence,
  reconcileSequencePlacements,
  type SequenceArtifact,
  type SequencePlacement,
} from "../src/index.js"

const fixture = (name: string) => readFile(join(process.cwd(), "fixtures", "sequence", name), "utf8")

async function collapseInput(language: "mermaid" | "d2") {
  const filename = language === "mermaid" ? "0_mermaid.mmd" : "2_d2.d2"
  const source = await fixture(filename)
  const built = language === "mermaid"
    ? await buildSequenceArtifact(mermaidSequenceAdapter, { locator: filename, source })
    : await buildSequenceArtifact(d2SequenceAdapter, { locator: filename, source })
  return { ...built, geometry: await measureSequenceSvg(built.artifact, built.bindingReceipt, built.renderReceipt) }
}

function descendants(artifact: SequenceArtifact, groupId: string): string[] {
  const result: string[] = []
  const pending = [groupId]
  while (pending.length > 0) {
    const parentId = pending.pop()
    for (const occurrence of artifact.occurrences) {
      if (occurrence.parentId !== parentId) continue
      result.push(occurrence.id)
      pending.push(occurrence.id)
    }
  }
  return result
}

function revisionArtifact(language: "mermaid" | "d2", filename: string) {
  return fixture(filename).then(source => {
    if (language === "mermaid") {
      return { occurrences: mermaidSequenceAdapter.identify(mermaidSequenceAdapter.parse(source)).occurrences } as SequenceArtifact
    }
    return { occurrences: d2SequenceAdapter.identify(d2SequenceAdapter.parse(source)).occurrences } as SequenceArtifact
  })
}

const revisionFiles = {
  mermaid: ["14_mermaid.a.mmd", "15_mermaid.b.mmd", "16_mermaid.c.mmd", "17_mermaid.d.mmd", "18_mermaid.e.mmd", "19_mermaid.f.mmd"],
  d2: ["20_d2.a.d2", "21_d2.b.d2", "22_d2.c.d2", "23_d2.d.d2", "24_d2.e.d2", "25_d2.f.d2"],
} as const

describe("sequence collapse and placement", () => {
  test("projects nested Mermaid and D2 group collapse deterministically and restores expanded geometry exactly", async () => {
    const [mermaid, d2] = await Promise.all([collapseInput("mermaid"), collapseInput("d2")])
    const receipt = (input: typeof mermaid) => {
      const outer = input.artifact.occurrences.find(occurrence => occurrence.kind === "group" && occurrence.label === "outer exchange")
      const nested = input.artifact.occurrences.find(occurrence => occurrence.kind === "group" && occurrence.label === "nested review")
      if (!outer || !nested) throw new Error("expected nested group fixture")
      const collapsed = projectCollapsedSequence(input.artifact, input.geometry, { collapsedGroupIds: [nested.id, outer.id] })
      const reversed = projectCollapsedSequence(input.artifact, input.geometry, { collapsedGroupIds: [outer.id, nested.id] })
      const outerOnly = projectCollapsedSequence(input.artifact, input.geometry, { collapsedGroupIds: [outer.id] })
      const expanded = projectCollapsedSequence(input.artifact, input.geometry, { collapsedGroupIds: [] })
      const descendantIds = new Set(descendants(input.artifact, outer.id))
      const archive = input.artifact.occurrences.find(occurrence => occurrence.kind === "message" && occurrence.label === "archive")
      const originalArchive = input.geometry.entities.find(entity => entity.occurrenceId === archive?.id)
      const collapsedArchive = collapsed.entities.find(entity => entity.elementId === originalArchive?.elementId)
      if (!archive || !originalArchive || !collapsedArchive) throw new Error("expected following archive geometry")
      return {
        collapsedEqualsReversed: collapsed.id === reversed.id && collapsed.entities.every((entity, index) => JSON.stringify(entity) === JSON.stringify(reversed.entities[index])),
        nestedDoesNotDoubleCollapse: collapsed.id === outerOnly.id && collapsed.entities.every((entity, index) => JSON.stringify(entity) === JSON.stringify(outerOnly.entities[index])),
        collapsedHeightDelta: input.geometry.viewBox.height - collapsed.viewBox.height,
        expandedExactlyOriginal: expanded === input.geometry,
        followingGeometryMovesByHeightDelta: originalArchive.worldBounds.y - collapsedArchive.worldBounds.y === input.geometry.viewBox.height - collapsed.viewBox.height,
        outerRolesRetained: collapsed.entities.filter(entity => entity.occurrenceId === outer.id).map(entity => entity.role),
        descendantEntitiesVisible: collapsed.entities.filter(entity => descendantIds.has(entity.occurrenceId)).length,
      }
    }
    const receipts = { mermaid: receipt(mermaid), d2: receipt(d2) }
    expect({
      mermaid: { deterministic: receipts.mermaid.collapsedEqualsReversed, nested: receipts.mermaid.nestedDoesNotDoubleCollapse, expanded: receipts.mermaid.expandedExactlyOriginal, followingMoves: receipts.mermaid.followingGeometryMovesByHeightDelta, descendants: receipts.mermaid.descendantEntitiesVisible, frameAndLabel: receipts.mermaid.outerRolesRetained.includes("group-frame") && receipts.mermaid.outerRolesRetained.includes("group-label") },
      d2: { deterministic: receipts.d2.collapsedEqualsReversed, nested: receipts.d2.nestedDoesNotDoubleCollapse, expanded: receipts.d2.expandedExactlyOriginal, followingMoves: receipts.d2.followingGeometryMovesByHeightDelta, descendants: receipts.d2.descendantEntitiesVisible, frameAndLabel: receipts.d2.outerRolesRetained.includes("group-frame") && receipts.d2.outerRolesRetained.includes("group-label") },
    }).toEqual({
      mermaid: { deterministic: true, nested: true, expanded: true, followingMoves: true, descendants: 0, frameAndLabel: true },
      d2: { deterministic: true, nested: true, expanded: true, followingMoves: true, descendants: 0, frameAndLabel: true },
    })
    expect(receipts).toMatchInlineSnapshot(`
      {
        "d2": {
          "collapsedEqualsReversed": true,
          "collapsedHeightDelta": 419.38811840198724,
          "descendantEntitiesVisible": 0,
          "expandedExactlyOriginal": true,
          "followingGeometryMovesByHeightDelta": true,
          "nestedDoesNotDoubleCollapse": true,
          "outerRolesRetained": [
            "group-frame",
            "group-label",
          ],
        },
        "mermaid": {
          "collapsedEqualsReversed": true,
          "collapsedHeightDelta": 253.99999999999994,
          "descendantEntitiesVisible": 0,
          "expandedExactlyOriginal": true,
          "followingGeometryMovesByHeightDelta": true,
          "nestedDoesNotDoubleCollapse": true,
          "outerRolesRetained": [
            "group-frame",
            "group-frame",
            "group-frame",
            "group-frame",
            "group-label",
          ],
        },
      }
    `)
  }, 60_000)

  test("reconciles manual deltas across insert, reorder, rename, regroup, and remove revisions for both languages", async () => {
    const receipt = async (language: "mermaid" | "d2") => {
      const revisions = await Promise.all(revisionFiles[language].map(filename => revisionArtifact(language, filename)))
      const [base, ...next] = revisions
      const actor = base.occurrences.find(occurrence => occurrence.kind === "actor" && occurrence.label === "Alice")
      const repeated = base.occurrences.find(occurrence => occurrence.kind === "message" && occurrence.label === "repeat")
      const archive = base.occurrences.find(occurrence => occurrence.kind === "message" && occurrence.label === "archive")
      if (!actor || !repeated || !archive) throw new Error("expected placement fixture occurrences")
      const placements: SequencePlacement[] = [
        { viewId: "sequence-view", occurrenceId: actor.id, baseGeometryRevisionId: "geometry:A", delta: { x: 11, y: -7 }, source: "manual" },
        { viewId: "sequence-view", occurrenceId: repeated.id, baseGeometryRevisionId: "geometry:A", delta: { x: 13, y: 17 }, source: "manual" },
        { viewId: "sequence-view", occurrenceId: archive.id, baseGeometryRevisionId: "geometry:A", delta: { x: -19, y: 23 }, source: "manual" },
      ]
      return next.map((artifact, index) => reconcileSequencePlacements(
        base,
        artifact,
        matchSequenceRevisions(base.occurrences, artifact.occurrences),
        placements,
        `geometry:${String.fromCharCode(66 + index)}`,
      ))
    }
    expect({ mermaid: await receipt("mermaid"), d2: await receipt("d2") }).toMatchInlineSnapshot(`
      {
        "d2": [
          {
            "blocked": [
              {
                "placement": {
                  "baseGeometryRevisionId": "geometry:A",
                  "delta": {
                    "x": 13,
                    "y": 17,
                  },
                  "occurrenceId": "d2:49a15df1:edge:alice->bob.work:repeat#3",
                  "source": "manual",
                  "viewId": "sequence-view",
                },
                "reason": "ambiguous",
              },
            ],
            "rebased": [
              {
                "baseGeometryRevisionId": "geometry:B",
                "delta": {
                  "x": 11,
                  "y": -7,
                },
                "occurrenceId": "d2:4151db90:actor:alice#0",
                "source": "manual",
                "viewId": "sequence-view",
              },
              {
                "baseGeometryRevisionId": "geometry:B",
                "delta": {
                  "x": -19,
                  "y": 23,
                },
                "occurrenceId": "d2:4151db90:edge:bob->archive:archive#8",
                "source": "manual",
                "viewId": "sequence-view",
              },
            ],
          },
          {
            "blocked": [
              {
                "placement": {
                  "baseGeometryRevisionId": "geometry:A",
                  "delta": {
                    "x": 13,
                    "y": 17,
                  },
                  "occurrenceId": "d2:49a15df1:edge:alice->bob.work:repeat#3",
                  "source": "manual",
                  "viewId": "sequence-view",
                },
                "reason": "ambiguous",
              },
            ],
            "rebased": [
              {
                "baseGeometryRevisionId": "geometry:C",
                "delta": {
                  "x": 11,
                  "y": -7,
                },
                "occurrenceId": "d2:d9e6edcf:actor:alice#0",
                "source": "manual",
                "viewId": "sequence-view",
              },
              {
                "baseGeometryRevisionId": "geometry:C",
                "delta": {
                  "x": -19,
                  "y": 23,
                },
                "occurrenceId": "d2:d9e6edcf:edge:bob->archive:archive#7",
                "source": "manual",
                "viewId": "sequence-view",
              },
            ],
          },
          {
            "blocked": [
              {
                "placement": {
                  "baseGeometryRevisionId": "geometry:A",
                  "delta": {
                    "x": 13,
                    "y": 17,
                  },
                  "occurrenceId": "d2:49a15df1:edge:alice->bob.work:repeat#3",
                  "source": "manual",
                  "viewId": "sequence-view",
                },
                "reason": "ambiguous",
              },
            ],
            "rebased": [
              {
                "baseGeometryRevisionId": "geometry:D",
                "delta": {
                  "x": 11,
                  "y": -7,
                },
                "occurrenceId": "d2:4bad4e40:actor:alice#0",
                "source": "manual",
                "viewId": "sequence-view",
              },
              {
                "baseGeometryRevisionId": "geometry:D",
                "delta": {
                  "x": -19,
                  "y": 23,
                },
                "occurrenceId": "d2:4bad4e40:edge:bob->archive:archive#7",
                "source": "manual",
                "viewId": "sequence-view",
              },
            ],
          },
          {
            "blocked": [
              {
                "placement": {
                  "baseGeometryRevisionId": "geometry:A",
                  "delta": {
                    "x": 13,
                    "y": 17,
                  },
                  "occurrenceId": "d2:49a15df1:edge:alice->bob.work:repeat#3",
                  "source": "manual",
                  "viewId": "sequence-view",
                },
                "reason": "ambiguous",
              },
              {
                "placement": {
                  "baseGeometryRevisionId": "geometry:A",
                  "delta": {
                    "x": -19,
                    "y": 23,
                  },
                  "occurrenceId": "d2:49a15df1:edge:bob->archive:archive#7",
                  "source": "manual",
                  "viewId": "sequence-view",
                },
                "reason": "not-retained",
              },
            ],
            "rebased": [
              {
                "baseGeometryRevisionId": "geometry:E",
                "delta": {
                  "x": 11,
                  "y": -7,
                },
                "occurrenceId": "d2:d8567141:actor:alice#0",
                "source": "manual",
                "viewId": "sequence-view",
              },
            ],
          },
          {
            "blocked": [
              {
                "placement": {
                  "baseGeometryRevisionId": "geometry:A",
                  "delta": {
                    "x": 13,
                    "y": 17,
                  },
                  "occurrenceId": "d2:49a15df1:edge:alice->bob.work:repeat#3",
                  "source": "manual",
                  "viewId": "sequence-view",
                },
                "reason": "ambiguous",
              },
            ],
            "rebased": [
              {
                "baseGeometryRevisionId": "geometry:F",
                "delta": {
                  "x": 11,
                  "y": -7,
                },
                "occurrenceId": "d2:dc947cd8:actor:alice#0",
                "source": "manual",
                "viewId": "sequence-view",
              },
              {
                "baseGeometryRevisionId": "geometry:F",
                "delta": {
                  "x": -19,
                  "y": 23,
                },
                "occurrenceId": "d2:dc947cd8:edge:bob->archive:archive#6",
                "source": "manual",
                "viewId": "sequence-view",
              },
            ],
          },
        ],
        "mermaid": [
          {
            "blocked": [
              {
                "placement": {
                  "baseGeometryRevisionId": "geometry:A",
                  "delta": {
                    "x": 13,
                    "y": 17,
                  },
                  "occurrenceId": "mermaid:092e83e2:message:alice->>bob:repeat#2",
                  "source": "manual",
                  "viewId": "sequence-view",
                },
                "reason": "ambiguous",
              },
            ],
            "rebased": [
              {
                "baseGeometryRevisionId": "geometry:B",
                "delta": {
                  "x": 11,
                  "y": -7,
                },
                "occurrenceId": "mermaid:2f7daa1f:participant:alice#0",
                "source": "manual",
                "viewId": "sequence-view",
              },
              {
                "baseGeometryRevisionId": "geometry:B",
                "delta": {
                  "x": -19,
                  "y": 23,
                },
                "occurrenceId": "mermaid:2f7daa1f:message:bob->>archive:archive#9",
                "source": "manual",
                "viewId": "sequence-view",
              },
            ],
          },
          {
            "blocked": [
              {
                "placement": {
                  "baseGeometryRevisionId": "geometry:A",
                  "delta": {
                    "x": 13,
                    "y": 17,
                  },
                  "occurrenceId": "mermaid:092e83e2:message:alice->>bob:repeat#2",
                  "source": "manual",
                  "viewId": "sequence-view",
                },
                "reason": "ambiguous",
              },
            ],
            "rebased": [
              {
                "baseGeometryRevisionId": "geometry:C",
                "delta": {
                  "x": 11,
                  "y": -7,
                },
                "occurrenceId": "mermaid:5b318670:participant:alice#0",
                "source": "manual",
                "viewId": "sequence-view",
              },
              {
                "baseGeometryRevisionId": "geometry:C",
                "delta": {
                  "x": -19,
                  "y": 23,
                },
                "occurrenceId": "mermaid:5b318670:message:bob->>archive:archive#8",
                "source": "manual",
                "viewId": "sequence-view",
              },
            ],
          },
          {
            "blocked": [
              {
                "placement": {
                  "baseGeometryRevisionId": "geometry:A",
                  "delta": {
                    "x": 13,
                    "y": 17,
                  },
                  "occurrenceId": "mermaid:092e83e2:message:alice->>bob:repeat#2",
                  "source": "manual",
                  "viewId": "sequence-view",
                },
                "reason": "ambiguous",
              },
            ],
            "rebased": [
              {
                "baseGeometryRevisionId": "geometry:D",
                "delta": {
                  "x": 11,
                  "y": -7,
                },
                "occurrenceId": "mermaid:95469281:participant:alice#0",
                "source": "manual",
                "viewId": "sequence-view",
              },
              {
                "baseGeometryRevisionId": "geometry:D",
                "delta": {
                  "x": -19,
                  "y": 23,
                },
                "occurrenceId": "mermaid:95469281:message:bob->>archive:archive#8",
                "source": "manual",
                "viewId": "sequence-view",
              },
            ],
          },
          {
            "blocked": [
              {
                "placement": {
                  "baseGeometryRevisionId": "geometry:A",
                  "delta": {
                    "x": 13,
                    "y": 17,
                  },
                  "occurrenceId": "mermaid:092e83e2:message:alice->>bob:repeat#2",
                  "source": "manual",
                  "viewId": "sequence-view",
                },
                "reason": "ambiguous",
              },
              {
                "placement": {
                  "baseGeometryRevisionId": "geometry:A",
                  "delta": {
                    "x": -19,
                    "y": 23,
                  },
                  "occurrenceId": "mermaid:092e83e2:message:bob->>archive:archive#8",
                  "source": "manual",
                  "viewId": "sequence-view",
                },
                "reason": "not-retained",
              },
            ],
            "rebased": [
              {
                "baseGeometryRevisionId": "geometry:E",
                "delta": {
                  "x": 11,
                  "y": -7,
                },
                "occurrenceId": "mermaid:b11a8058:participant:alice#0",
                "source": "manual",
                "viewId": "sequence-view",
              },
            ],
          },
          {
            "blocked": [
              {
                "placement": {
                  "baseGeometryRevisionId": "geometry:A",
                  "delta": {
                    "x": 13,
                    "y": 17,
                  },
                  "occurrenceId": "mermaid:092e83e2:message:alice->>bob:repeat#2",
                  "source": "manual",
                  "viewId": "sequence-view",
                },
                "reason": "ambiguous",
              },
            ],
            "rebased": [
              {
                "baseGeometryRevisionId": "geometry:F",
                "delta": {
                  "x": 11,
                  "y": -7,
                },
                "occurrenceId": "mermaid:e75cdc5b:participant:alice#0",
                "source": "manual",
                "viewId": "sequence-view",
              },
              {
                "baseGeometryRevisionId": "geometry:F",
                "delta": {
                  "x": -19,
                  "y": 23,
                },
                "occurrenceId": "mermaid:e75cdc5b:message:bob->>archive:archive#7",
                "source": "manual",
                "viewId": "sequence-view",
              },
            ],
          },
        ],
      }
    `)
  })
})
