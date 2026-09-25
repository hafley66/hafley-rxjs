import { expect, it } from "vitest";
import type { MdPlugin } from "../plugins/0_types.js";
import { resolveMdPlugins } from "./3_mdPlugins.js";

const FirstFence = () => null;
const SecondFence = () => null;
const FirstTable = () => null;
const SecondTable = () => null;
const highlight = { name: "shiki" } as unknown as NonNullable<MdPlugin["highlight"]>;

it("resolves slots in array order: the earliest claimant of a language or slot wins", () => {
  const plugins: MdPlugin[] = [
    { name: "first", fence: { languages: ["mermaid", "graph"], component: FirstFence }, table: FirstTable },
    { name: "fmt-ts", command: { match: "^ts$", command: "prettier", as: "replace" } },
    { name: "second", fence: { languages: ["mermaid", "d2"], component: SecondFence }, table: SecondTable, highlight },
    { name: "shadowed", fence: { languages: ["d2"], component: FirstFence } },
    { name: "lint-sh", command: { match: "^sh$", command: "shellcheck", as: "annotate" } },
  ];
  const set = resolveMdPlugins(plugins);
  expect({
    ...set,
    fences: set.fences.map((fence) => ({ ...fence, component: fence.component.name })),
    table: set.table?.name,
  }).toMatchInlineSnapshot(`
    {
      "commands": [
        {
          "as": "replace",
          "command": "prettier",
          "match": "^ts$",
        },
        {
          "as": "annotate",
          "command": "shellcheck",
          "match": "^sh$",
        },
      ],
      "fences": [
        {
          "component": "FirstFence",
          "languages": [
            "mermaid",
            "graph",
          ],
          "name": "first",
        },
        {
          "component": "SecondFence",
          "languages": [
            "d2",
          ],
          "name": "second",
        },
      ],
      "highlight": {
        "name": "shiki",
      },
      "table": "FirstTable",
    }
  `);
});

it("resolves an empty array to no special renderers", () => {
  expect(resolveMdPlugins([])).toMatchInlineSnapshot(`
    {
      "commands": [],
      "fences": [],
      "highlight": undefined,
      "table": undefined,
    }
  `);
});

it("resolves the inline slots to their earliest claimant, and leaves unclaimed ones off the set", () => {
  const FirstCode = () => null;
  const SecondCode = () => null;
  const FirstLink = () => null;
  const FirstImage = () => null;
  const set = resolveMdPlugins([
    { name: "code-a", inlineCode: FirstCode },
    { name: "table", table: FirstTable },
    { name: "code-b", inlineCode: SecondCode, link: FirstLink },
    { name: "image", image: FirstImage },
  ]);
  const linkOnly = resolveMdPlugins([{ name: "link", link: FirstLink }]);
  expect({
    inlineCode: set.inlineCode?.name,
    link: set.link?.name,
    image: set.image?.name,
    linkOnlyKeys: Object.keys(linkOnly),
  }).toMatchInlineSnapshot(`
    {
      "image": "FirstImage",
      "inlineCode": "FirstCode",
      "link": "FirstLink",
      "linkOnlyKeys": [
        "fences",
        "table",
        "highlight",
        "commands",
        "link",
      ],
    }
  `);
});
