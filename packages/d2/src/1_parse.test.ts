import { readFile } from "node:fs/promises"

import { describe, expect, test } from "vitest"

import { parseD2Sequence } from "./1_parse"

const fixtureDirectory = new URL("../../../fixtures/sequence/", import.meta.url)

describe("D2 local sequence document", () => {
  test("preserves source order, repeated messages, nested groups, spans, and notes", async () => {
    const source = await readFile(new URL("2_d2.d2", fixtureDirectory), "utf8")

    expect(parseD2Sequence(source)).toMatchInlineSnapshot(`
      {
        "actors": [
          {
            "id": "alice",
            "key": "actor:alice#0",
            "kind": "actor",
            "label": "Alice",
            "ordinal": 0,
            "sourceSpan": {
              "end": 36,
              "lineEnd": 2,
              "lineStart": 2,
              "start": 24,
            },
          },
          {
            "id": "bob",
            "key": "actor:bob#1",
            "kind": "actor",
            "label": "Bob",
            "ordinal": 1,
            "sourceSpan": {
              "end": 45,
              "lineEnd": 3,
              "lineStart": 3,
              "start": 37,
            },
          },
          {
            "id": "archive",
            "key": "actor:archive#2",
            "kind": "actor",
            "label": "Archive Service Far Right",
            "ordinal": 2,
            "sourceSpan": {
              "end": 80,
              "lineEnd": 4,
              "lineStart": 4,
              "start": 46,
            },
          },
        ],
        "diagnostics": [],
        "directives": [
          {
            "key": "directive:shape#0",
            "kind": "directive",
            "ordinal": 0,
            "property": "shape",
            "sourceSpan": {
              "end": 23,
              "lineEnd": 1,
              "lineStart": 1,
              "start": 0,
            },
            "value": "sequence_diagram",
          },
        ],
        "edges": [
          {
            "key": "edge:alice->bob.work:repeat#3",
            "kind": "edge",
            "label": "repeat",
            "ordinal": 3,
            "parentGroupKey": "group:nested review#1",
            "source": {
              "actor": "alice",
              "sourceSpan": {
                "end": 127,
                "lineEnd": 7,
                "lineStart": 7,
                "start": 122,
              },
            },
            "sourceSpan": {
              "end": 147,
              "lineEnd": 7,
              "lineStart": 7,
              "start": 122,
            },
            "target": {
              "actor": "bob",
              "sourceSpan": {
                "end": 139,
                "lineEnd": 7,
                "lineStart": 7,
                "start": 131,
              },
              "span": "work",
            },
          },
          {
            "key": "edge:bob.work->bob.work:inspect#4",
            "kind": "edge",
            "label": "inspect",
            "ordinal": 4,
            "parentGroupKey": "group:nested review#1",
            "source": {
              "actor": "bob",
              "sourceSpan": {
                "end": 160,
                "lineEnd": 8,
                "lineStart": 8,
                "start": 152,
              },
              "span": "work",
            },
            "sourceSpan": {
              "end": 181,
              "lineEnd": 8,
              "lineStart": 8,
              "start": 152,
            },
            "target": {
              "actor": "bob",
              "sourceSpan": {
                "end": 172,
                "lineEnd": 8,
                "lineStart": 8,
                "start": 164,
              },
              "span": "work",
            },
          },
          {
            "key": "edge:alice->bob.work:repeat#6",
            "kind": "edge",
            "label": "repeat",
            "ordinal": 6,
            "parentGroupKey": "group:nested review#1",
            "source": {
              "actor": "alice",
              "sourceSpan": {
                "end": 212,
                "lineEnd": 10,
                "lineStart": 10,
                "start": 207,
              },
            },
            "sourceSpan": {
              "end": 232,
              "lineEnd": 10,
              "lineStart": 10,
              "start": 207,
            },
            "target": {
              "actor": "bob",
              "sourceSpan": {
                "end": 224,
                "lineEnd": 10,
                "lineStart": 10,
                "start": 216,
              },
              "span": "work",
            },
          },
          {
            "key": "edge:bob->archive:archive#7",
            "kind": "edge",
            "label": "archive",
            "ordinal": 7,
            "source": {
              "actor": "bob",
              "sourceSpan": {
                "end": 242,
                "lineEnd": 13,
                "lineStart": 13,
                "start": 239,
              },
            },
            "sourceSpan": {
              "end": 262,
              "lineEnd": 13,
              "lineStart": 13,
              "start": 239,
            },
            "target": {
              "actor": "archive",
              "sourceSpan": {
                "end": 253,
                "lineEnd": 13,
                "lineStart": 13,
                "start": 246,
              },
            },
          },
        ],
        "groups": [
          {
            "key": "group:outer exchange#0",
            "kind": "group",
            "label": "outer exchange",
            "ordinal": 1,
            "sourceSpan": {
              "end": 238,
              "lineEnd": 12,
              "lineStart": 5,
              "start": 81,
            },
            "statements": [
              {
                "key": "group:nested review#1",
                "kind": "group",
                "label": "nested review",
                "ordinal": 2,
                "parentGroupKey": "group:outer exchange#0",
                "sourceSpan": {
                  "end": 236,
                  "lineEnd": 11,
                  "lineStart": 6,
                  "start": 101,
                },
                "statements": [
                  {
                    "key": "edge:alice->bob.work:repeat#3",
                    "kind": "edge",
                    "label": "repeat",
                    "ordinal": 3,
                    "parentGroupKey": "group:nested review#1",
                    "source": {
                      "actor": "alice",
                      "sourceSpan": {
                        "end": 127,
                        "lineEnd": 7,
                        "lineStart": 7,
                        "start": 122,
                      },
                    },
                    "sourceSpan": {
                      "end": 147,
                      "lineEnd": 7,
                      "lineStart": 7,
                      "start": 122,
                    },
                    "target": {
                      "actor": "bob",
                      "sourceSpan": {
                        "end": 139,
                        "lineEnd": 7,
                        "lineStart": 7,
                        "start": 131,
                      },
                      "span": "work",
                    },
                  },
                  {
                    "key": "edge:bob.work->bob.work:inspect#4",
                    "kind": "edge",
                    "label": "inspect",
                    "ordinal": 4,
                    "parentGroupKey": "group:nested review#1",
                    "source": {
                      "actor": "bob",
                      "sourceSpan": {
                        "end": 160,
                        "lineEnd": 8,
                        "lineStart": 8,
                        "start": 152,
                      },
                      "span": "work",
                    },
                    "sourceSpan": {
                      "end": 181,
                      "lineEnd": 8,
                      "lineStart": 8,
                      "start": 152,
                    },
                    "target": {
                      "actor": "bob",
                      "sourceSpan": {
                        "end": 172,
                        "lineEnd": 8,
                        "lineStart": 8,
                        "start": 164,
                      },
                      "span": "work",
                    },
                  },
                  {
                    "actor": "bob",
                    "key": "note:bob:local note#5",
                    "kind": "note",
                    "label": "local note",
                    "ordinal": 5,
                    "parentGroupKey": "group:nested review#1",
                    "sourceSpan": {
                      "end": 202,
                      "lineEnd": 9,
                      "lineStart": 9,
                      "start": 186,
                    },
                  },
                  {
                    "key": "edge:alice->bob.work:repeat#6",
                    "kind": "edge",
                    "label": "repeat",
                    "ordinal": 6,
                    "parentGroupKey": "group:nested review#1",
                    "source": {
                      "actor": "alice",
                      "sourceSpan": {
                        "end": 212,
                        "lineEnd": 10,
                        "lineStart": 10,
                        "start": 207,
                      },
                    },
                    "sourceSpan": {
                      "end": 232,
                      "lineEnd": 10,
                      "lineStart": 10,
                      "start": 207,
                    },
                    "target": {
                      "actor": "bob",
                      "sourceSpan": {
                        "end": 224,
                        "lineEnd": 10,
                        "lineStart": 10,
                        "start": 216,
                      },
                      "span": "work",
                    },
                  },
                ],
              },
            ],
          },
          {
            "key": "group:nested review#1",
            "kind": "group",
            "label": "nested review",
            "ordinal": 2,
            "parentGroupKey": "group:outer exchange#0",
            "sourceSpan": {
              "end": 236,
              "lineEnd": 11,
              "lineStart": 6,
              "start": 101,
            },
            "statements": [
              {
                "key": "edge:alice->bob.work:repeat#3",
                "kind": "edge",
                "label": "repeat",
                "ordinal": 3,
                "parentGroupKey": "group:nested review#1",
                "source": {
                  "actor": "alice",
                  "sourceSpan": {
                    "end": 127,
                    "lineEnd": 7,
                    "lineStart": 7,
                    "start": 122,
                  },
                },
                "sourceSpan": {
                  "end": 147,
                  "lineEnd": 7,
                  "lineStart": 7,
                  "start": 122,
                },
                "target": {
                  "actor": "bob",
                  "sourceSpan": {
                    "end": 139,
                    "lineEnd": 7,
                    "lineStart": 7,
                    "start": 131,
                  },
                  "span": "work",
                },
              },
              {
                "key": "edge:bob.work->bob.work:inspect#4",
                "kind": "edge",
                "label": "inspect",
                "ordinal": 4,
                "parentGroupKey": "group:nested review#1",
                "source": {
                  "actor": "bob",
                  "sourceSpan": {
                    "end": 160,
                    "lineEnd": 8,
                    "lineStart": 8,
                    "start": 152,
                  },
                  "span": "work",
                },
                "sourceSpan": {
                  "end": 181,
                  "lineEnd": 8,
                  "lineStart": 8,
                  "start": 152,
                },
                "target": {
                  "actor": "bob",
                  "sourceSpan": {
                    "end": 172,
                    "lineEnd": 8,
                    "lineStart": 8,
                    "start": 164,
                  },
                  "span": "work",
                },
              },
              {
                "actor": "bob",
                "key": "note:bob:local note#5",
                "kind": "note",
                "label": "local note",
                "ordinal": 5,
                "parentGroupKey": "group:nested review#1",
                "sourceSpan": {
                  "end": 202,
                  "lineEnd": 9,
                  "lineStart": 9,
                  "start": 186,
                },
              },
              {
                "key": "edge:alice->bob.work:repeat#6",
                "kind": "edge",
                "label": "repeat",
                "ordinal": 6,
                "parentGroupKey": "group:nested review#1",
                "source": {
                  "actor": "alice",
                  "sourceSpan": {
                    "end": 212,
                    "lineEnd": 10,
                    "lineStart": 10,
                    "start": 207,
                  },
                },
                "sourceSpan": {
                  "end": 232,
                  "lineEnd": 10,
                  "lineStart": 10,
                  "start": 207,
                },
                "target": {
                  "actor": "bob",
                  "sourceSpan": {
                    "end": 224,
                    "lineEnd": 10,
                    "lineStart": 10,
                    "start": 216,
                  },
                  "span": "work",
                },
              },
            ],
          },
        ],
        "language": "d2",
        "notes": [
          {
            "actor": "bob",
            "key": "note:bob:local note#5",
            "kind": "note",
            "label": "local note",
            "ordinal": 5,
            "parentGroupKey": "group:nested review#1",
            "sourceSpan": {
              "end": 202,
              "lineEnd": 9,
              "lineStart": 9,
              "start": 186,
            },
          },
        ],
        "spans": [
          {
            "actor": "bob",
            "key": "span:bob.work#0",
            "kind": "span",
            "name": "work",
            "ordinal": 0,
            "parentGroupKey": "group:nested review#1",
            "sourceSpan": {
              "end": 139,
              "lineEnd": 7,
              "lineStart": 7,
              "start": 131,
            },
          },
        ],
        "statements": [
          {
            "key": "directive:shape#0",
            "kind": "directive",
            "ordinal": 0,
            "property": "shape",
            "sourceSpan": {
              "end": 23,
              "lineEnd": 1,
              "lineStart": 1,
              "start": 0,
            },
            "value": "sequence_diagram",
          },
          {
            "key": "group:outer exchange#0",
            "kind": "group",
            "label": "outer exchange",
            "ordinal": 1,
            "sourceSpan": {
              "end": 238,
              "lineEnd": 12,
              "lineStart": 5,
              "start": 81,
            },
            "statements": [
              {
                "key": "group:nested review#1",
                "kind": "group",
                "label": "nested review",
                "ordinal": 2,
                "parentGroupKey": "group:outer exchange#0",
                "sourceSpan": {
                  "end": 236,
                  "lineEnd": 11,
                  "lineStart": 6,
                  "start": 101,
                },
                "statements": [
                  {
                    "key": "edge:alice->bob.work:repeat#3",
                    "kind": "edge",
                    "label": "repeat",
                    "ordinal": 3,
                    "parentGroupKey": "group:nested review#1",
                    "source": {
                      "actor": "alice",
                      "sourceSpan": {
                        "end": 127,
                        "lineEnd": 7,
                        "lineStart": 7,
                        "start": 122,
                      },
                    },
                    "sourceSpan": {
                      "end": 147,
                      "lineEnd": 7,
                      "lineStart": 7,
                      "start": 122,
                    },
                    "target": {
                      "actor": "bob",
                      "sourceSpan": {
                        "end": 139,
                        "lineEnd": 7,
                        "lineStart": 7,
                        "start": 131,
                      },
                      "span": "work",
                    },
                  },
                  {
                    "key": "edge:bob.work->bob.work:inspect#4",
                    "kind": "edge",
                    "label": "inspect",
                    "ordinal": 4,
                    "parentGroupKey": "group:nested review#1",
                    "source": {
                      "actor": "bob",
                      "sourceSpan": {
                        "end": 160,
                        "lineEnd": 8,
                        "lineStart": 8,
                        "start": 152,
                      },
                      "span": "work",
                    },
                    "sourceSpan": {
                      "end": 181,
                      "lineEnd": 8,
                      "lineStart": 8,
                      "start": 152,
                    },
                    "target": {
                      "actor": "bob",
                      "sourceSpan": {
                        "end": 172,
                        "lineEnd": 8,
                        "lineStart": 8,
                        "start": 164,
                      },
                      "span": "work",
                    },
                  },
                  {
                    "actor": "bob",
                    "key": "note:bob:local note#5",
                    "kind": "note",
                    "label": "local note",
                    "ordinal": 5,
                    "parentGroupKey": "group:nested review#1",
                    "sourceSpan": {
                      "end": 202,
                      "lineEnd": 9,
                      "lineStart": 9,
                      "start": 186,
                    },
                  },
                  {
                    "key": "edge:alice->bob.work:repeat#6",
                    "kind": "edge",
                    "label": "repeat",
                    "ordinal": 6,
                    "parentGroupKey": "group:nested review#1",
                    "source": {
                      "actor": "alice",
                      "sourceSpan": {
                        "end": 212,
                        "lineEnd": 10,
                        "lineStart": 10,
                        "start": 207,
                      },
                    },
                    "sourceSpan": {
                      "end": 232,
                      "lineEnd": 10,
                      "lineStart": 10,
                      "start": 207,
                    },
                    "target": {
                      "actor": "bob",
                      "sourceSpan": {
                        "end": 224,
                        "lineEnd": 10,
                        "lineStart": 10,
                        "start": 216,
                      },
                      "span": "work",
                    },
                  },
                ],
              },
            ],
          },
          {
            "key": "edge:bob->archive:archive#7",
            "kind": "edge",
            "label": "archive",
            "ordinal": 7,
            "source": {
              "actor": "bob",
              "sourceSpan": {
                "end": 242,
                "lineEnd": 13,
                "lineStart": 13,
                "start": 239,
              },
            },
            "sourceSpan": {
              "end": 262,
              "lineEnd": 13,
              "lineStart": 13,
              "start": 239,
            },
            "target": {
              "actor": "archive",
              "sourceSpan": {
                "end": 253,
                "lineEnd": 13,
                "lineStart": 13,
                "start": 246,
              },
            },
          },
        ],
      }
    `)
  })

  test("reports local source diagnostics deterministically", () => {
    expect(
      parseD2Sequence("shape: sequence_diagram\nouter: {\nalice -> bob: repeat\n}\n}\ninvalid\nhanging: {\n"),
    ).toMatchInlineSnapshot(`
      {
        "actors": [],
        "diagnostics": [
          {
            "code": "D2_UNMATCHED_CLOSE",
            "message": "line 5: } has no open group",
            "sourceSpan": {
              "end": 57,
              "lineEnd": 5,
              "lineStart": 5,
              "start": 56,
            },
          },
          {
            "code": "D2_UNSUPPORTED_STATEMENT",
            "message": "line 6: unsupported D2 sequence statement",
            "sourceSpan": {
              "end": 65,
              "lineEnd": 6,
              "lineStart": 6,
              "start": 58,
            },
          },
          {
            "code": "D2_UNCLOSED_GROUP",
            "message": "line 7: hanging has no closing }",
            "sourceSpan": {
              "end": 76,
              "lineEnd": 7,
              "lineStart": 7,
              "start": 66,
            },
          },
        ],
        "directives": [
          {
            "key": "directive:shape#0",
            "kind": "directive",
            "ordinal": 0,
            "property": "shape",
            "sourceSpan": {
              "end": 23,
              "lineEnd": 1,
              "lineStart": 1,
              "start": 0,
            },
            "value": "sequence_diagram",
          },
        ],
        "edges": [
          {
            "key": "edge:alice->bob:repeat#2",
            "kind": "edge",
            "label": "repeat",
            "ordinal": 2,
            "parentGroupKey": "group:outer#0",
            "source": {
              "actor": "alice",
              "sourceSpan": {
                "end": 38,
                "lineEnd": 3,
                "lineStart": 3,
                "start": 33,
              },
            },
            "sourceSpan": {
              "end": 53,
              "lineEnd": 3,
              "lineStart": 3,
              "start": 33,
            },
            "target": {
              "actor": "bob",
              "sourceSpan": {
                "end": 45,
                "lineEnd": 3,
                "lineStart": 3,
                "start": 42,
              },
            },
          },
        ],
        "groups": [
          {
            "key": "group:outer#0",
            "kind": "group",
            "label": "outer",
            "ordinal": 1,
            "sourceSpan": {
              "end": 55,
              "lineEnd": 4,
              "lineStart": 2,
              "start": 24,
            },
            "statements": [
              {
                "key": "edge:alice->bob:repeat#2",
                "kind": "edge",
                "label": "repeat",
                "ordinal": 2,
                "parentGroupKey": "group:outer#0",
                "source": {
                  "actor": "alice",
                  "sourceSpan": {
                    "end": 38,
                    "lineEnd": 3,
                    "lineStart": 3,
                    "start": 33,
                  },
                },
                "sourceSpan": {
                  "end": 53,
                  "lineEnd": 3,
                  "lineStart": 3,
                  "start": 33,
                },
                "target": {
                  "actor": "bob",
                  "sourceSpan": {
                    "end": 45,
                    "lineEnd": 3,
                    "lineStart": 3,
                    "start": 42,
                  },
                },
              },
            ],
          },
          {
            "key": "group:hanging#1",
            "kind": "group",
            "label": "hanging",
            "ordinal": 3,
            "sourceSpan": {
              "end": 76,
              "lineEnd": 7,
              "lineStart": 7,
              "start": 66,
            },
            "statements": [],
          },
        ],
        "language": "d2",
        "notes": [],
        "spans": [],
        "statements": [
          {
            "key": "directive:shape#0",
            "kind": "directive",
            "ordinal": 0,
            "property": "shape",
            "sourceSpan": {
              "end": 23,
              "lineEnd": 1,
              "lineStart": 1,
              "start": 0,
            },
            "value": "sequence_diagram",
          },
          {
            "key": "group:outer#0",
            "kind": "group",
            "label": "outer",
            "ordinal": 1,
            "sourceSpan": {
              "end": 55,
              "lineEnd": 4,
              "lineStart": 2,
              "start": 24,
            },
            "statements": [
              {
                "key": "edge:alice->bob:repeat#2",
                "kind": "edge",
                "label": "repeat",
                "ordinal": 2,
                "parentGroupKey": "group:outer#0",
                "source": {
                  "actor": "alice",
                  "sourceSpan": {
                    "end": 38,
                    "lineEnd": 3,
                    "lineStart": 3,
                    "start": 33,
                  },
                },
                "sourceSpan": {
                  "end": 53,
                  "lineEnd": 3,
                  "lineStart": 3,
                  "start": 33,
                },
                "target": {
                  "actor": "bob",
                  "sourceSpan": {
                    "end": 45,
                    "lineEnd": 3,
                    "lineStart": 3,
                    "start": 42,
                  },
                },
              },
            ],
          },
          {
            "key": "group:hanging#1",
            "kind": "group",
            "label": "hanging",
            "ordinal": 3,
            "sourceSpan": {
              "end": 76,
              "lineEnd": 7,
              "lineStart": 7,
              "start": 66,
            },
            "statements": [],
          },
        ],
      }
    `)
  })
})
