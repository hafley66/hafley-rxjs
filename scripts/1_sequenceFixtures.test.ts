import { readFile } from "node:fs/promises"

import { describe, expect, test } from "vitest"

import {
  renderD2SequenceSmoke,
  renderMermaidSequenceSmoke,
} from "./0_sequenceRendererSmoke.mjs"

type ExpectedOccurrence = {
  fixtureKey: string
  kind: "actor" | "message" | "group" | "activation" | "note"
  parentFixtureKey?: string
  sourceActorFixtureKey?: string
  targetActorFixtureKey?: string
  label?: string
}

type SequenceFixtureExpectation = {
  language: "mermaid" | "d2"
  source: string
  initialViewportWidth: number
  expectedOccurrences: ExpectedOccurrence[]
}

const fixtureDirectory = new URL("../fixtures/sequence/", import.meta.url)

async function readFixtureExpectation(filename: string) {
  return JSON.parse(
    await readFile(new URL(filename, fixtureDirectory), "utf8"),
  ) as SequenceFixtureExpectation
}

async function readFixtureSource(expectation: SequenceFixtureExpectation) {
  return readFile(new URL(expectation.source, fixtureDirectory), "utf8")
}

function readViewBox(svg: string) {
  const value = svg.match(/\bviewBox="([^"]+)"/)?.[1]

  if (!value) {
    throw new Error("rendered sequence SVG has no viewBox")
  }

  const [x, y, width, height] = value.split(/\s+/).map(Number)
  return { x, y, width, height }
}

describe("equivalent Mermaid and D2 sequence fixtures", () => {
  test("preserves the same occurrence expectation keys", async () => {
    const [mermaid, d2] = await Promise.all([
      readFixtureExpectation("1_mermaid.expected.json"),
      readFixtureExpectation("3_d2.expected.json"),
    ])
    const mermaidKeys = mermaid.expectedOccurrences.map(
      (occurrence) => occurrence.fixtureKey,
    )
    const d2Keys = d2.expectedOccurrences.map(
      (occurrence) => occurrence.fixtureKey,
    )

    expect({
      languages: [mermaid.language, d2.language],
      sources: [mermaid.source, d2.source],
      occurrenceCount: mermaid.expectedOccurrences.length,
      keysEqual: mermaidKeys.join("\n") === d2Keys.join("\n"),
      occurrences: mermaid.expectedOccurrences,
    }).toMatchInlineSnapshot(`
      {
        "keysEqual": true,
        "languages": [
          "mermaid",
          "d2",
        ],
        "occurrenceCount": 11,
        "occurrences": [
          {
            "fixtureKey": "actor-alice",
            "kind": "actor",
            "label": "Alice",
          },
          {
            "fixtureKey": "actor-bob",
            "kind": "actor",
            "label": "Bob",
          },
          {
            "fixtureKey": "actor-archive",
            "kind": "actor",
            "label": "Archive Service Far Right",
          },
          {
            "fixtureKey": "group-outer",
            "kind": "group",
            "label": "outer exchange",
          },
          {
            "fixtureKey": "group-nested",
            "kind": "group",
            "label": "nested review",
            "parentFixtureKey": "group-outer",
          },
          {
            "fixtureKey": "message-repeat-1",
            "kind": "message",
            "label": "repeat",
            "parentFixtureKey": "group-nested",
            "sourceActorFixtureKey": "actor-alice",
            "targetActorFixtureKey": "actor-bob",
          },
          {
            "fixtureKey": "activation-bob",
            "kind": "activation",
            "parentFixtureKey": "group-nested",
            "targetActorFixtureKey": "actor-bob",
          },
          {
            "fixtureKey": "message-self",
            "kind": "message",
            "label": "inspect",
            "parentFixtureKey": "group-nested",
            "sourceActorFixtureKey": "actor-bob",
            "targetActorFixtureKey": "actor-bob",
          },
          {
            "fixtureKey": "note-bob",
            "kind": "note",
            "label": "local note",
            "parentFixtureKey": "group-nested",
            "targetActorFixtureKey": "actor-bob",
          },
          {
            "fixtureKey": "message-repeat-2",
            "kind": "message",
            "label": "repeat",
            "parentFixtureKey": "group-nested",
            "sourceActorFixtureKey": "actor-alice",
            "targetActorFixtureKey": "actor-bob",
          },
          {
            "fixtureKey": "message-archive",
            "kind": "message",
            "label": "archive",
            "sourceActorFixtureKey": "actor-bob",
            "targetActorFixtureKey": "actor-archive",
          },
        ],
        "sources": [
          "0_mermaid.mmd",
          "2_d2.d2",
        ],
      }
    `)
  })

  test(
    "renders both sources beyond the initial horizontal viewport",
    async () => {
      const [mermaidExpectation, d2Expectation] = await Promise.all([
        readFixtureExpectation("1_mermaid.expected.json"),
        readFixtureExpectation("3_d2.expected.json"),
      ])
      const [mermaidSource, d2Source] = await Promise.all([
        readFixtureSource(mermaidExpectation),
        readFixtureSource(d2Expectation),
      ])
      const [mermaid, d2] = await Promise.all([
        renderMermaidSequenceSmoke(mermaidSource),
        renderD2SequenceSmoke(d2Source),
      ])
      const mermaidViewBox = readViewBox(mermaid.svg)
      const d2ViewBox = readViewBox(d2.svg)

      expect({
        mermaid: {
          version: mermaid.version,
          viewBox: mermaidViewBox,
          initialViewportWidth: mermaidExpectation.initialViewportWidth,
          exceedsInitialViewport:
            mermaidViewBox.width > mermaidExpectation.initialViewportWidth,
          labels: {
            actors: ["Alice", "Bob", "Archive Service Far Right"].map(
              (label) => mermaid.svg.includes(label),
            ),
            messages: ["repeat", "inspect", "archive"].map((label) =>
              mermaid.svg.includes(label),
            ),
            groups: ["outer exchange", "nested review"].map((label) =>
              mermaid.svg.includes(label),
            ),
            note: mermaid.svg.includes("local note"),
          },
        },
        d2: {
          version: d2.version,
          viewBox: d2ViewBox,
          initialViewportWidth: d2Expectation.initialViewportWidth,
          exceedsInitialViewport:
            d2ViewBox.width > d2Expectation.initialViewportWidth,
          labels: {
            actors: ["Alice", "Bob", "Archive Service Far Right"].map(
              (label) => d2.svg.includes(label),
            ),
            messages: ["repeat", "inspect", "archive"].map((label) =>
              d2.svg.includes(label),
            ),
            groups: ["outer exchange", "nested review"].map((label) =>
              d2.svg.includes(label),
            ),
            note: d2.svg.includes("local note"),
          },
        },
      }).toMatchInlineSnapshot(`
        {
          "d2": {
            "exceedsInitialViewport": true,
            "initialViewportWidth": 320,
            "labels": {
              "actors": [
                true,
                true,
                true,
              ],
              "groups": [
                true,
                true,
              ],
              "messages": [
                true,
                true,
                true,
              ],
              "note": true,
            },
            "version": "0.7.1",
            "viewBox": {
              "height": 911,
              "width": 704,
              "x": 0,
              "y": 0,
            },
          },
          "mermaid": {
            "exceedsInitialViewport": true,
            "initialViewportWidth": 320,
            "labels": {
              "actors": [
                true,
                true,
                true,
              ],
              "groups": [
                true,
                true,
              ],
              "messages": [
                true,
                true,
                true,
              ],
              "note": true,
            },
            "version": "11.16.0",
            "viewBox": {
              "height": 534,
              "width": 701,
              "x": -50,
              "y": -10,
            },
          },
        }
      `)
    },
    60_000,
  )
})
