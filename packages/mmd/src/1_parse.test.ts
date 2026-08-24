import { readFile } from "node:fs/promises"

import mermaid from "mermaid"
import { describe, expect, test } from "vitest"

import { parseMermaidSequence } from "./1_parse"

const fixtureDirectory = new URL("../../../fixtures/sequence/", import.meta.url)

describe("Mermaid local sequence document", () => {
  test("preserves source order, repeated messages, nested groups, and spans", async () => {
    const source = await readFile(new URL("0_mermaid.mmd", fixtureDirectory), "utf8")
    const document = parseMermaidSequence(source)

    mermaid.initialize({ startOnLoad: false })

    expect(await mermaid.parse(source, { suppressErrors: true })).toMatchInlineSnapshot(`
      {
        "config": {},
        "diagramType": "sequence",
      }
    `)
    expect(document).toMatchInlineSnapshot(`
      {
        "diagnostics": [],
        "language": "mermaid",
        "participants": [
          {
            "form": "participant",
            "id": "alice",
            "key": "participant:alice#0",
            "kind": "participant",
            "label": "Alice",
            "ordinal": 0,
            "sourceSpan": {
              "end": 44,
              "lineEnd": 2,
              "lineStart": 2,
              "start": 18,
            },
          },
          {
            "form": "participant",
            "id": "bob",
            "key": "participant:bob#1",
            "kind": "participant",
            "label": "Bob",
            "ordinal": 1,
            "sourceSpan": {
              "end": 69,
              "lineEnd": 3,
              "lineStart": 3,
              "start": 47,
            },
          },
          {
            "form": "participant",
            "id": "archive",
            "key": "participant:archive#2",
            "kind": "participant",
            "label": "Archive Service Far Right",
            "ordinal": 2,
            "sourceSpan": {
              "end": 120,
              "lineEnd": 4,
              "lineStart": 4,
              "start": 72,
            },
          },
        ],
        "statements": [
          {
            "form": "loop",
            "key": "group:loop:outer exchange#0",
            "kind": "group",
            "label": "outer exchange",
            "ordinal": 0,
            "sourceSpan": {
              "end": 331,
              "lineEnd": 14,
              "lineStart": 5,
              "start": 123,
            },
            "statements": [
              {
                "form": "alt",
                "key": "group:alt:nested review#1",
                "kind": "group",
                "label": "nested review",
                "ordinal": 1,
                "sourceSpan": {
                  "end": 325,
                  "lineEnd": 13,
                  "lineStart": 6,
                  "start": 147,
                },
                "statements": [
                  {
                    "arrow": "->>",
                    "from": "alice",
                    "key": "message:alice->>bob:repeat#2",
                    "kind": "message",
                    "label": "repeat",
                    "ordinal": 2,
                    "sourceSpan": {
                      "end": 190,
                      "lineEnd": 7,
                      "lineStart": 7,
                      "start": 171,
                    },
                    "to": "bob",
                  },
                  {
                    "action": "activate",
                    "key": "activation:activate:bob#3",
                    "kind": "activation",
                    "ordinal": 3,
                    "sourceSpan": {
                      "end": 209,
                      "lineEnd": 8,
                      "lineStart": 8,
                      "start": 197,
                    },
                    "target": "bob",
                  },
                  {
                    "arrow": "->>",
                    "from": "bob",
                    "key": "message:bob->>bob:inspect#4",
                    "kind": "message",
                    "label": "inspect",
                    "ordinal": 4,
                    "sourceSpan": {
                      "end": 234,
                      "lineEnd": 9,
                      "lineStart": 9,
                      "start": 216,
                    },
                    "to": "bob",
                  },
                  {
                    "key": "note:right of:bob:local note#5",
                    "kind": "note",
                    "label": "local note",
                    "ordinal": 5,
                    "placement": "right of",
                    "sourceSpan": {
                      "end": 270,
                      "lineEnd": 10,
                      "lineStart": 10,
                      "start": 241,
                    },
                    "target": "bob",
                  },
                  {
                    "arrow": "->>",
                    "from": "alice",
                    "key": "message:alice->>bob:repeat#6",
                    "kind": "message",
                    "label": "repeat",
                    "ordinal": 6,
                    "sourceSpan": {
                      "end": 296,
                      "lineEnd": 11,
                      "lineStart": 11,
                      "start": 277,
                    },
                    "to": "bob",
                  },
                  {
                    "action": "deactivate",
                    "key": "activation:deactivate:bob#7",
                    "kind": "activation",
                    "ordinal": 7,
                    "sourceSpan": {
                      "end": 317,
                      "lineEnd": 12,
                      "lineStart": 12,
                      "start": 303,
                    },
                    "target": "bob",
                  },
                ],
              },
            ],
          },
          {
            "arrow": "->>",
            "from": "bob",
            "key": "message:bob->>archive:archive#8",
            "kind": "message",
            "label": "archive",
            "ordinal": 8,
            "sourceSpan": {
              "end": 356,
              "lineEnd": 15,
              "lineStart": 15,
              "start": 334,
            },
            "to": "archive",
          },
        ],
      }
    `)
  })

  test("reports local source diagnostics deterministically", () => {
    expect(
      parseMermaidSequence(
        "sequenceDiagram\n  loop open\n  alice->>bob: repeat\n  end\n  end\n  unsupported\n  alt hanging\n",
      ),
    ).toMatchInlineSnapshot(`
      {
        "diagnostics": [
          {
            "code": "MERMAID_UNMATCHED_END",
            "message": "line 5: end has no open group",
            "sourceSpan": {
              "end": 61,
              "lineEnd": 5,
              "lineStart": 5,
              "start": 58,
            },
          },
          {
            "code": "MERMAID_UNSUPPORTED_STATEMENT",
            "message": "line 6: unsupported sequence statement",
            "sourceSpan": {
              "end": 75,
              "lineEnd": 6,
              "lineStart": 6,
              "start": 64,
            },
          },
          {
            "code": "MERMAID_UNCLOSED_GROUP",
            "message": "line 7: alt has no closing end",
            "sourceSpan": {
              "end": 89,
              "lineEnd": 7,
              "lineStart": 7,
              "start": 78,
            },
          },
        ],
        "language": "mermaid",
        "participants": [],
        "statements": [
          {
            "form": "loop",
            "key": "group:loop:open#0",
            "kind": "group",
            "label": "open",
            "ordinal": 0,
            "sourceSpan": {
              "end": 55,
              "lineEnd": 4,
              "lineStart": 2,
              "start": 18,
            },
            "statements": [
              {
                "arrow": "->>",
                "from": "alice",
                "key": "message:alice->>bob:repeat#1",
                "kind": "message",
                "label": "repeat",
                "ordinal": 1,
                "sourceSpan": {
                  "end": 49,
                  "lineEnd": 3,
                  "lineStart": 3,
                  "start": 30,
                },
                "to": "bob",
              },
            ],
          },
          {
            "form": "alt",
            "key": "group:alt:hanging#2",
            "kind": "group",
            "label": "hanging",
            "ordinal": 2,
            "sourceSpan": {
              "end": 89,
              "lineEnd": 7,
              "lineStart": 7,
              "start": 78,
            },
            "statements": [],
          },
        ],
      }
    `)
  })
})
