import { expect, it } from "vitest";
import { mdDocument, type MdBlock } from "@hafley66/grapht-model";
import { absoluteSpan, fenceOriginOf, withFenceOrigins } from "./0b_fenceOrigin.js";

const fence = "```";
const DOC = [
  "---",
  "title: example",
  "---",
  "",
  "# Alpha",
  "",
  `${fence}mermaid`,
  "sequenceDiagram",
  "  Alice->>Bob: hello",
  fence,
  "",
  "# Beta",
  "",
  `${fence}d2`,
  "shape: sequence_diagram",
  "alice: Alice",
  "bob: Bob",
  "alice -> bob: hello",
  fence,
  "",
].join("\n");

const codeBlocks = (blocks: readonly MdBlock[]) => blocks.filter((block) => block.kind === "code");
const originsIn = (marked: string) =>
  [...marked.matchAll(/\{md-origin=(\d+):(\d+)\}/gu)].map((match) => [Number(match[1]), Number(match[2])]);

it("marks each fence with its absolute origin and reads it back", () => {
  const document = mdDocument("docs/example.md", DOC);
  const alpha = document.doc.byId.get("alpha")!;
  const marked = withFenceOrigins(
    document.text.slice(alpha.ownStart, alpha.ownEnd),
    alpha.ownStart,
    document.blocks.filter((block) => block.section === "alpha"),
  );

  const mermaid = codeBlocks(document.blocks).find((block) => block.language === "mermaid")!;
  expect(originsIn(marked)).toEqual([[mermaid.codeStart!, mermaid.span.lineStart + 1]]);
  expect(fenceOriginOf(`{md-origin=${mermaid.codeStart}:${mermaid.span.lineStart + 1}}`)).toEqual({
    start: mermaid.codeStart,
    lineStart: mermaid.span.lineStart + 1,
  });
  expect(fenceOriginOf("{.line-numbers}")).toBeUndefined();
  expect(marked.slice(marked.indexOf("sequenceDiagram"))).toContain("  Alice->>Bob: hello");
});

it("leaves every fence body byte-identical on both languages", () => {
  const document = mdDocument("docs/example.md", DOC);
  const marked = withFenceOrigins(document.text, 0, document.blocks);
  const reparsed = mdDocument("docs/example.md", marked);
  const bodies = (source: string, blocks: readonly MdBlock[]) =>
    codeBlocks(blocks).map((block) => source.slice(block.codeStart, block.codeEnd));

  expect(bodies(marked, reparsed.blocks)).toEqual(bodies(DOC, document.blocks));
  expect(reparsed.blocks.filter((block) => block.kind === "code").map((block) => block.language)).toEqual(["mermaid", "d2"]);
  expect(originsIn(marked)).toEqual(codeBlocks(document.blocks).map((block) => [block.codeStart, block.span.lineStart + 1]));
});

it("gives identical fences distinct origins", () => {
  const text = ["", `${fence}mermaid`, "sequenceDiagram", "  Alice->>Bob: hello", fence, "", `${fence}mermaid`, "sequenceDiagram", "  Alice->>Bob: hello", fence, ""].join("\n");
  const document = mdDocument("docs/example.md", text);
  const origins = originsIn(withFenceOrigins(text, 0, document.blocks));

  expect(origins).toHaveLength(2);
  expect(origins[0]![0]).not.toBe(origins[1]![0]);
  expect(origins.map(([start]) => text.slice(start, start + "sequenceDiagram".length))).toEqual([
    "sequenceDiagram",
    "sequenceDiagram",
  ]);
});

it("places a fence-relative span in the file", () => {
  const origin = { start: 40, lineStart: 7 };
  expect(absoluteSpan({ start: 15, end: 20, lineStart: 3, lineEnd: 3 }, origin)).toEqual({
    start: 55,
    end: 60,
    lineStart: 9,
    lineEnd: 9,
  });
});
