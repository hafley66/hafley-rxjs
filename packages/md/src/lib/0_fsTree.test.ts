import { expect, it } from "vitest";
import { parseFsTree, type FsTreeNode } from "./0_fsTree.js";

/** One line per node, depth as indentation, so a snapshot reads like the tree it came from. */
const outline = (nodes: readonly FsTreeNode[], depth = 0): string[] =>
  nodes.flatMap((node) => [
    `${"  ".repeat(depth)}${node.kind === "dir" ? "d" : "f"} ${node.name} [${node.path}]${node.note === undefined ? "" : ` # ${node.note}`}`,
    ...outline(node.children, depth + 1),
  ]);

const shape = (text: string) => {
  const tree = parseFsTree(text);
  return { format: tree.format, outline: outline(tree.roots) };
};

it("parses `tree` output, unicode and ASCII connectors, notes, and the summary line", () => {
  const unicode = [
    ".",
    "├── package.json",
    "├── src/            # sources",
    "│   ├── index.ts",
    "│   └── lib",
    "│       └── 0_types.ts",
    "└── README.md",
    "",
    "2 directories, 4 files",
  ].join("\n");
  const ascii = [
    "app",
    "|-- bin",
    "|   `-- run",
    "`-- docs/",
  ].join("\n");
  expect({ unicode: shape(unicode), ascii: shape(ascii) }).toMatchInlineSnapshot(`
    {
      "ascii": {
        "format": "tree",
        "outline": [
          "d app [app]",
          "  d bin [app/bin]",
          "    f run [app/bin/run]",
          "  d docs [app/docs]",
        ],
      },
      "unicode": {
        "format": "tree",
        "outline": [
          "d . [.]",
          "  f package.json [./package.json]",
          "  d src [./src] # sources",
          "    f index.ts [./src/index.ts]",
          "    d lib [./src/lib]",
          "      f 0_types.ts [./src/lib/0_types.ts]",
          "  f README.md [./README.md]",
        ],
      },
    }
  `);
});

it("parses `ls -R` output, with and without a leading `.:` header", () => {
  const gnu = [
    ".:",
    "README.md  src",
    "",
    "./src:",
    "index.ts",
    "lib",
    "",
    "./src/lib:",
    "0_types.ts",
  ].join("\n");
  const bsd = [
    "README.md\tsrc/",
    "",
    "./src:",
    "index.ts",
  ].join("\n");
  expect({ gnu: shape(gnu), bsd: shape(bsd) }).toMatchInlineSnapshot(`
    {
      "bsd": {
        "format": "ls",
        "outline": [
          "f README.md [README.md]",
          "d src [src]",
          "  f index.ts [src/index.ts]",
        ],
      },
      "gnu": {
        "format": "ls",
        "outline": [
          "f README.md [README.md]",
          "d src [src]",
          "  f index.ts [src/index.ts]",
          "  d lib [src/lib]",
          "    f 0_types.ts [src/lib/0_types.ts]",
        ],
      },
    }
  `);
});

it("parses `find` output, dropping the `.` line and merging shared prefixes", () => {
  const find = [
    ".",
    "./src",
    "./src/index.ts",
    "./src/lib/0_types.ts",
    "./docs/",
    "./README.md",
  ].join("\n");
  expect(shape(find)).toMatchInlineSnapshot(`
    {
      "format": "find",
      "outline": [
        "d src [src]",
        "  f index.ts [src/index.ts]",
        "  d lib [src/lib]",
        "    f 0_types.ts [src/lib/0_types.ts]",
        "d docs [docs]",
        "f README.md [README.md]",
      ],
    }
  `);
});

it("parses indented path lists, with list markers, notes, and mixed widths", () => {
  const indented = [
    "packages/",
    "  md/",
    "    src/",
    "      - plugins/     # fence renderers",
    "        * 2_fsTreePlugin.tsx",
    "    package.json",
    "  grid",
    "README.md",
  ].join("\n");
  expect(shape(indented)).toMatchInlineSnapshot(`
    {
      "format": "indent",
      "outline": [
        "d packages [packages]",
        "  d md [packages/md]",
        "    d src [packages/md/src]",
        "      d plugins [packages/md/src/plugins] # fence renderers",
        "        f 2_fsTreePlugin.tsx [packages/md/src/plugins/2_fsTreePlugin.tsx]",
        "    f package.json [packages/md/package.json]",
        "  f grid [packages/grid]",
        "f README.md [README.md]",
      ],
    }
  `);
});

it("returns the model itself: names, paths, kinds, notes, children", () => {
  expect(parseFsTree(["├── a/  # first", "│   └── b.ts", "└── c"].join("\n"))).toMatchInlineSnapshot(`
    {
      "format": "tree",
      "roots": [
        {
          "children": [
            {
              "children": [],
              "kind": "file",
              "name": "b.ts",
              "path": "a/b.ts",
            },
          ],
          "kind": "dir",
          "name": "a",
          "note": "first",
          "path": "a",
        },
        {
          "children": [],
          "kind": "file",
          "name": "c",
          "path": "c",
        },
      ],
    }
  `);
});

it("keeps one node per path when a listing repeats a folder", () => {
  expect(shape(["src/", "  a.ts", "src/", "  b.ts", "", ""].join("\n"))).toMatchInlineSnapshot(`
    {
      "format": "indent",
      "outline": [
        "d src [src]",
        "  f a.ts [src/a.ts]",
        "  f b.ts [src/b.ts]",
      ],
    }
  `);
});
