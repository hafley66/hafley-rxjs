import { firstValueFrom, lastValueFrom, NEVER, of, throwError, toArray } from "rxjs";
import { expect, it } from "vitest";
import type { MdFenceCommand, MdFenceCommandRequest, MdFenceCommandRunner } from "../plugins/0_types.js";
import { fenceColumns, fenceCommandPass, fenceSpans, shiftOffsets } from "./4_fenceCommands.js";

const markdown = [
  "# Title",
  "",
  "```ts",
  "const a={b:1}",
  "```",
  "",
  "| a |",
  "| - |",
  "| 1 |",
  "",
  "```sh",
  "echo $x",
  "```",
  "",
  "```rust",
  "fn main(){}",
  "```",
  "",
].join("\n");

const commands: MdFenceCommand[] = [
  { match: "^(ts|tsx)$", command: "prettier --print-width $WIDTH", as: "replace" },
  { match: "^ts$", command: "shadowed", as: "annotate" },
  { match: "^sh$", command: "shellcheck", as: "annotate" },
];

it("finds closed column-one fences with their body ranges", () => {
  expect(fenceSpans(markdown).map((span) => ({ ...span, body: markdown.slice(span.bodyStart, span.bodyEnd) }))).toMatchInlineSnapshot(`
    [
      {
        "body": "const a={b:1}
    ",
        "bodyEnd": 29,
        "bodyStart": 15,
        "end": 32,
        "indent": "",
        "language": "ts",
      },
      {
        "body": "echo $x
    ",
        "bodyEnd": 67,
        "bodyStart": 59,
        "end": 70,
        "indent": "",
        "language": "sh",
      },
      {
        "body": "fn main(){}
    ",
        "bodyEnd": 92,
        "bodyStart": 80,
        "end": 95,
        "indent": "",
        "language": "rust",
      },
    ]
  `);
});

it("replaces matched fence bodies and annotates under lint fences; first matching command wins", async () => {
  const requests: MdFenceCommandRequest[] = [];
  const run: MdFenceCommandRunner = (request) => {
    requests.push(request);
    return request.language === "ts"
      ? of({ stdout: "const a = { b: 1 };\n", stderr: "", code: 0 })
      : of({ stdout: "x.sh:1:6: warning: quote this [SC2086]\n", stderr: "", code: 1 });
  };
  const passes = await lastValueFrom(fenceCommandPass(markdown, commands, run, 72).pipe(toArray()));
  const last = passes.at(-1)!;
  const tableStart = markdown.indexOf("| a |");
  expect({
    requests,
    text: last.text,
    edits: last.edits,
    tableMovesWith: last.text.slice(shiftOffsets([tableStart], last.edits)[0]).startsWith("| a |"),
  }).toMatchInlineSnapshot(`
    {
      "edits": [
        {
          "at": 15,
          "insert": "const a = { b: 1 };
    ",
          "remove": 14,
        },
        {
          "at": 70,
          "insert": "

    \`\`\`text
    x.sh:1:6: warning: quote this [SC2086]
    \`\`\`",
          "remove": 0,
        },
      ],
      "requests": [
        {
          "columns": 72,
          "command": "prettier --print-width $WIDTH",
          "language": "ts",
          "text": "const a={b:1}
    ",
        },
        {
          "columns": 72,
          "command": "shellcheck",
          "language": "sh",
          "text": "echo $x
    ",
        },
      ],
      "tableMovesWith": true,
      "text": "# Title

    \`\`\`ts
    const a = { b: 1 };
    \`\`\`

    | a |
    | - |
    | 1 |

    \`\`\`sh
    echo $x
    \`\`\`

    \`\`\`text
    x.sh:1:6: warning: quote this [SC2086]
    \`\`\`

    \`\`\`rust
    fn main(){}
    \`\`\`
    ",
    }
  `);
});

it("keeps the fence as written on a failed replace and surfaces stderr under it", async () => {
  const run: MdFenceCommandRunner = () => of({ stdout: "", stderr: "SyntaxError: ';' expected", code: 2 });
  const pass = await lastValueFrom(fenceCommandPass("```ts\nconst =\n```\n", commands, run, 80));
  expect(pass.text).toMatchInlineSnapshot(`
    "\`\`\`ts
    const =
    \`\`\`

    \`\`\`text
    SyntaxError: ';' expected
    \`\`\`
    "
  `);
});

it("emits nothing without a runner, without a matching command, or while the host has not answered", async () => {
  const none = await lastValueFrom(fenceCommandPass(markdown, commands, undefined, 80).pipe(toArray()));
  const unmatched = await lastValueFrom(fenceCommandPass("```go\nx\n```\n", commands, () => of({ stdout: "y", stderr: "", code: 0 }), 80).pipe(toArray()));
  const errored = await firstValueFrom(fenceCommandPass(markdown, [commands[0]!], () => throwError(() => new Error("spawn")), 80));
  const pending: unknown[] = [];
  fenceCommandPass(markdown, commands, () => NEVER, 80).subscribe((pass) => pending.push(pass)).unsubscribe();
  expect({ none, unmatched, errored: errored.text === markdown, pending }).toMatchInlineSnapshot(`
    {
      "errored": true,
      "none": [],
      "pending": [],
      "unmatched": [],
    }
  `);
});

it("shows each answer as it lands while other fences are still running", () => {
  const run: MdFenceCommandRunner = (request) => request.language === "ts" ? of({ stdout: "ts()\n", stderr: "", code: 0 }) : NEVER;
  const seen: string[] = [];
  fenceCommandPass(markdown, commands, run, 80).subscribe((pass) => seen.push(pass.text.slice(0, 23))).unsubscribe();
  expect(seen).toEqual(["# Title\n\n```ts\nts()\n```"]);
});

it("skips a command whose match is not a valid RegExp", async () => {
  const run: MdFenceCommandRunner = () => of({ stdout: "formatted\n", stderr: "", code: 0 });
  const passes = await lastValueFrom(fenceCommandPass(markdown, [{ match: "(", command: "x", as: "replace" }], run, 80).pipe(toArray()));
  expect(passes).toEqual([]);
});

it("derives formatter columns from the prose width", () => {
  expect([fenceColumns(900), fenceColumns(420), fenceColumns(100)]).toMatchInlineSnapshot(`
    [
      115,
      53,
      20,
    ]
  `);
});

it("formats fences indented inside list items, dedenting for the command", async () => {
  const indented = [
    "1. Step",
    "",
    "   ```sh",
    "   echo $x",
    "   ```",
    "",
  ].join("\n");
  const seen: MdFenceCommandRequest[] = [];
  const run: MdFenceCommandRunner = (request) => {
    seen.push(request);
    return of({ stdout: "echo \"$x\"\n", stderr: "", code: 0 });
  };
  const listCommands: MdFenceCommand[] = [{ match: "^sh$", command: "shellcheck", as: "replace" }];
  const pass = await lastValueFrom(fenceCommandPass(indented, listCommands, run, 72));
  expect(pass.text).toBe([
    "1. Step",
    "",
    "   ```sh",
    "   echo \"$x\"",
    "   ```",
    "",
  ].join("\n"));
  // 72 prose columns minus the 3-space list indent: the formatter wraps inside it.
  expect(seen).toEqual([{ command: "shellcheck", language: "sh", text: "echo $x\n", columns: 69 }]);
});
