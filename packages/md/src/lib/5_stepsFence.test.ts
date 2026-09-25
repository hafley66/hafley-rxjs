import { expect, it } from "vitest";
import { parseStepsFence } from "./5_stepsFence.js";

const literal = [
  "const total = items.length",
  "--- step filter done items",
  "const total = items",
  "  .filter((item) => item.done)",
  "  .length",
].join("\n");

const patched = [
  "--- step: base",
  "const a = 1",
  "--- step add b",
  "@@ -1 +1,2 @@",
  " const a = 1",
  "+const b = 2",
  "--- step rename a",
  "@@ -1,2 +1,2 @@",
  "-const a = 1",
  "+const first = 1",
  " const b = 2",
].join("\n");

it("splits literal states on `--- step` lines; the meta's first word is the language", () => {
  expect(parseStepsFence(literal, "ts")).toMatchInlineSnapshot(`
    {
      "lang": "ts",
      "steps": [
        {
          "code": "const total = items.length",
          "from": "literal",
          "title": "",
        },
        {
          "code": "const total = items
      .filter((item) => item.done)
      .length",
          "from": "literal",
          "title": "filter done items",
        },
      ],
    }
  `);
});

it("applies hunk-only patches to the previous state and keeps titles, including step 0's", () => {
  expect(parseStepsFence(patched, "rust extra words")).toMatchInlineSnapshot(`
    {
      "lang": "rust",
      "steps": [
        {
          "code": "const a = 1",
          "from": "literal",
          "title": "base",
        },
        {
          "code": "const a = 1
    const b = 2",
          "from": "patch",
          "title": "add b",
        },
        {
          "code": "const first = 1
    const b = 2",
          "from": "patch",
          "title": "rename a",
        },
      ],
    }
  `);
});

it("a patch that does not apply keeps the previous state and names the failure", () => {
  const broken = ["one", "--- step bad", "@@ -1 +1 @@", "-two", "+three"].join("\n");
  expect(parseStepsFence(broken, undefined)).toMatchInlineSnapshot(`
    {
      "lang": "",
      "steps": [
        {
          "code": "one",
          "from": "literal",
          "title": "",
        },
        {
          "code": "one",
          "error": "patch does not apply to the previous step",
          "from": "patch",
          "title": "bad",
        },
      ],
    }
  `);
});

it("a fence with no separators is one step; the trailing newline drops; an explicit empty step stays", () => {
  expect([parseStepsFence("x = 1\n", "py"), parseStepsFence("", "py"), parseStepsFence("a\n--- step\n\n--- step last\nb\n", "")]).toMatchInlineSnapshot(`
    [
      {
        "lang": "py",
        "steps": [
          {
            "code": "x = 1",
            "from": "literal",
            "title": "",
          },
        ],
      },
      {
        "lang": "py",
        "steps": [
          {
            "code": "",
            "from": "literal",
            "title": "",
          },
        ],
      },
      {
        "lang": "",
        "steps": [
          {
            "code": "a",
            "from": "literal",
            "title": "",
          },
          {
            "code": "",
            "from": "literal",
            "title": "",
          },
          {
            "code": "b",
            "from": "literal",
            "title": "last",
          },
        ],
      },
    ]
  `);
});
