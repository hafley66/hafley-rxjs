import { readFile } from "node:fs/promises"
import { describe, expect, test } from "vitest"
import { d2SequenceAdapter } from "../../d2/src/index.js"
import { mermaidSequenceAdapter } from "../../mmd/src/index.js"
import { buildSequenceArtifact, measureSequenceSvg, resolveSequenceFocus } from "../src/index.js"

const fixtures = new URL("../../../fixtures/sequence/", import.meta.url)
const source = (name: string) => readFile(new URL(name, fixtures), "utf8")
const boundsEqual = (
  left: { x: number; y: number; width: number; height: number }[],
  right: { x: number; y: number; width: number; height: number }[],
) => left.length === right.length && left.every((bounds, index) => Object.entries(bounds).every(([key, value]) => Math.abs(value - right[index][key as keyof typeof bounds]) < 1))

describe("sequence geometry and focus", () => {
  test("measures Mermaid and D2 bindings, including CSS-size-independent Mermaid viewBox geometry", async () => {
    const [mermaid, d2] = await Promise.all([
      buildSequenceArtifact(mermaidSequenceAdapter, { locator: "0_mermaid.mmd", source: await source("0_mermaid.mmd") }),
      buildSequenceArtifact(d2SequenceAdapter, { locator: "2_d2.d2", source: await source("2_d2.d2") }),
    ])
    const missingBinding = { ...mermaid.bindingReceipt.bindings[0], elementId: "missing-sequence-binding" }
    const [small, large, d2Geometry, missing] = await Promise.all([
      measureSequenceSvg(mermaid.artifact, mermaid.bindingReceipt, mermaid.renderReceipt, { cssWidth: 350 }),
      measureSequenceSvg(mermaid.artifact, mermaid.bindingReceipt, mermaid.renderReceipt, { cssWidth: 1400 }),
      measureSequenceSvg(d2.artifact, d2.bindingReceipt, d2.renderReceipt),
      measureSequenceSvg(mermaid.artifact, { ...mermaid.bindingReceipt, bindings: [...mermaid.bindingReceipt.bindings, missingBinding] }, mermaid.renderReceipt),
    ])
    expect({ mermaid: { diagnostics: small.diagnostics, entityCountMatches: small.entities.length === mermaid.artifact.bindings.length, fontsReady: small.browser.fontsReady, worldBoundsStableWithinOneViewBoxUnit: boundsEqual(small.entities.map(entity => entity.worldBounds), large.entities.map(entity => entity.worldBounds)), coordinateSpace: small.coordinateSpace }, d2: { diagnostics: d2Geometry.diagnostics, entityCountMatches: d2Geometry.entities.length === d2.artifact.bindings.length, fontsReady: d2Geometry.browser.fontsReady, coordinateSpace: d2Geometry.coordinateSpace }, missingDiagnostics: missing.diagnostics }).toMatchInlineSnapshot(`
      {
        "d2": {
          "coordinateSpace": "svg-viewBox",
          "diagnostics": [],
          "entityCountMatches": true,
          "fontsReady": true,
        },
        "mermaid": {
          "coordinateSpace": "svg-viewBox",
          "diagnostics": [],
          "entityCountMatches": true,
          "fontsReady": true,
          "worldBoundsStableWithinOneViewBoxUnit": true,
        },
        "missingDiagnostics": [
          {
            "code": "SEQUENCE_MISSING_SVG_BINDING",
            "count": 0,
            "elementId": "missing-sequence-binding",
            "occurrenceId": "mermaid:092e83e2:participant:alice#0",
          },
        ],
      }
    `)
  }, 60_000)

  test("resolves equivalent message, self-message, activation, nested-group, actor, and missing focus without DOM", async () => {
    const [mermaid, d2] = await Promise.all([
      buildSequenceArtifact(mermaidSequenceAdapter, { locator: "0_mermaid.mmd", source: await source("0_mermaid.mmd") }),
      buildSequenceArtifact(d2SequenceAdapter, { locator: "2_d2.d2", source: await source("2_d2.d2") }),
    ])
    const select = (artifact: typeof mermaid.artifact, kind: string, label?: string) => artifact.occurrences.find(item => item.kind === kind && item.label === label)?.id ?? "missing"
    const comparableFocus = (artifact: typeof mermaid.artifact, occurrenceId: string) => {
      const focus = resolveSequenceFocus(artifact, occurrenceId)
      return {
        actorLabels: focus.actorIds.map(id => artifact.occurrences.find(occurrence => occurrence.id === id)?.label),
        groupLabels: focus.groupIds.map(id => artifact.occurrences.find(occurrence => occurrence.id === id)?.label),
      }
    }
    const equivalent = {
      mermaid: {
        message: comparableFocus(mermaid.artifact, select(mermaid.artifact, "message", "repeat")),
        self: comparableFocus(mermaid.artifact, select(mermaid.artifact, "message", "inspect")),
        activation: comparableFocus(mermaid.artifact, select(mermaid.artifact, "activation", "activate")),
      },
      d2: {
        message: comparableFocus(d2.artifact, select(d2.artifact, "message", "repeat")),
        self: comparableFocus(d2.artifact, select(d2.artifact, "message", "inspect")),
        activation: comparableFocus(d2.artifact, select(d2.artifact, "activation", "work")),
      },
    }
    expect(equivalent.mermaid).toEqual(equivalent.d2)
    expect(equivalent).toMatchInlineSnapshot(`
      {
        "d2": {
          "activation": {
            "actorLabels": [
              "Bob",
            ],
            "groupLabels": [
              "outer exchange",
              "nested review",
            ],
          },
          "message": {
            "actorLabels": [
              "Alice",
              "Bob",
            ],
            "groupLabels": [
              "outer exchange",
              "nested review",
            ],
          },
          "self": {
            "actorLabels": [
              "Bob",
            ],
            "groupLabels": [
              "outer exchange",
              "nested review",
            ],
          },
        },
        "mermaid": {
          "activation": {
            "actorLabels": [
              "Bob",
            ],
            "groupLabels": [
              "outer exchange",
              "nested review",
            ],
          },
          "message": {
            "actorLabels": [
              "Alice",
              "Bob",
            ],
            "groupLabels": [
              "outer exchange",
              "nested review",
            ],
          },
          "self": {
            "actorLabels": [
              "Bob",
            ],
            "groupLabels": [
              "outer exchange",
              "nested review",
            ],
          },
        },
      }
    `)
    expect({ mermaid: { message: resolveSequenceFocus(mermaid.artifact, select(mermaid.artifact, "message", "repeat")), self: resolveSequenceFocus(mermaid.artifact, select(mermaid.artifact, "message", "inspect")), activation: resolveSequenceFocus(mermaid.artifact, select(mermaid.artifact, "activation", "activate")), actor: resolveSequenceFocus(mermaid.artifact, select(mermaid.artifact, "actor", "Alice")), missing: resolveSequenceFocus(mermaid.artifact, "missing") }, d2: { message: resolveSequenceFocus(d2.artifact, select(d2.artifact, "message", "repeat")), self: resolveSequenceFocus(d2.artifact, select(d2.artifact, "message", "inspect")), activation: resolveSequenceFocus(d2.artifact, select(d2.artifact, "activation", "work")) } }).toMatchInlineSnapshot(`
      {
        "d2": {
          "activation": {
            "actorIds": [
              "d2:49a15df1:actor:bob#1",
            ],
            "groupIds": [
              "d2:49a15df1:group:outer exchange#0",
              "d2:49a15df1:group:nested review#1",
            ],
            "hoveredOccurrenceId": "d2:49a15df1:span:bob.work#0",
          },
          "message": {
            "actorIds": [
              "d2:49a15df1:actor:alice#0",
              "d2:49a15df1:actor:bob#1",
            ],
            "groupIds": [
              "d2:49a15df1:group:outer exchange#0",
              "d2:49a15df1:group:nested review#1",
            ],
            "hoveredOccurrenceId": "d2:49a15df1:edge:alice->bob.work:repeat#3",
          },
          "self": {
            "actorIds": [
              "d2:49a15df1:actor:bob#1",
            ],
            "groupIds": [
              "d2:49a15df1:group:outer exchange#0",
              "d2:49a15df1:group:nested review#1",
            ],
            "hoveredOccurrenceId": "d2:49a15df1:edge:bob.work->bob.work:inspect#4",
          },
        },
        "mermaid": {
          "activation": {
            "actorIds": [
              "mermaid:092e83e2:participant:bob#1",
            ],
            "groupIds": [
              "mermaid:092e83e2:group:loop:outer exchange#0",
              "mermaid:092e83e2:group:alt:nested review#1",
            ],
            "hoveredOccurrenceId": "mermaid:092e83e2:activation:activate:bob#3",
          },
          "actor": {
            "actorIds": [
              "mermaid:092e83e2:participant:alice#0",
            ],
            "groupIds": [],
            "hoveredOccurrenceId": "mermaid:092e83e2:participant:alice#0",
          },
          "message": {
            "actorIds": [
              "mermaid:092e83e2:participant:alice#0",
              "mermaid:092e83e2:participant:bob#1",
            ],
            "groupIds": [
              "mermaid:092e83e2:group:loop:outer exchange#0",
              "mermaid:092e83e2:group:alt:nested review#1",
            ],
            "hoveredOccurrenceId": "mermaid:092e83e2:message:alice->>bob:repeat#2",
          },
          "missing": {
            "actorIds": [],
            "groupIds": [],
          },
          "self": {
            "actorIds": [
              "mermaid:092e83e2:participant:bob#1",
            ],
            "groupIds": [
              "mermaid:092e83e2:group:loop:outer exchange#0",
              "mermaid:092e83e2:group:alt:nested review#1",
            ],
            "hoveredOccurrenceId": "mermaid:092e83e2:message:bob->>bob:inspect#4",
          },
        },
      }
    `)
  }, 60_000)
})
