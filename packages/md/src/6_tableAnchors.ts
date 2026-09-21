import { unified } from "unified";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import type { Content, Parent, Root } from "mdast";

const parser = unified().use(remarkParse).use(remarkGfm);

function tableStartsOf(node: Parent | Root, starts: number[]): void {
  for (const child of node.children as readonly Content[]) {
    if (child.type === "table") {
      const start = child.position?.start.offset;
      if (start !== undefined) starts.push(start);
    }
    if ("children" in child && Array.isArray(child.children)) {
      tableStartsOf(child as Parent, starts);
    }
  }
}

/** Absolute source offsets for every GFM table in parser source order. */
export function markdownTableStarts(markdown: string, sliceStart = 0): readonly number[] {
  const root = parser.parse(markdown) as Root;
  const starts: number[] = [];
  tableStartsOf(root, starts);
  return starts.sort((left, right) => left - right).map((start) => start + sliceStart);
}
