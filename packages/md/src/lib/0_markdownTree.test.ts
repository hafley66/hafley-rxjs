import { expect, it } from "vitest";
import { markdownHeadingRows } from "./0_markdownTree.js";

it("projects three heading levels into file tree rows", () => {
  const text = "# Alpha\n\n## Beta\n\n### Gamma\n";
  expect(markdownHeadingRows("/docs/guide.md", text)).toMatchInlineSnapshot(`
    [
      {
        "depth": 1,
        "headingId": "alpha",
        "id": "/docs/guide.md#alpha",
        "kind": "heading",
        "label": "Alpha",
        "path": "/docs/guide.md",
      },
      {
        "depth": 2,
        "headingId": "beta",
        "id": "/docs/guide.md#beta",
        "kind": "heading",
        "label": "Beta",
        "path": "/docs/guide.md",
      },
      {
        "depth": 3,
        "headingId": "gamma",
        "id": "/docs/guide.md#gamma",
        "kind": "heading",
        "label": "Gamma",
        "path": "/docs/guide.md",
      },
    ]
  `);
});
