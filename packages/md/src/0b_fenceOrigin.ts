// Streamdown hands a fenced renderer its code, language, and metastring, but not
// the fence's position in the document. The metastring is the only channel it
// exposes, so a fence's absolute origin travels there: `mdview.css`-level
// rendering is unaffected because Streamdown renders only the language, and the
// body the diagram sees is untouched.
import type { MdBlock, SourceSpan } from "@hafley66/grapht-model";

/** Where a fence body starts, in the file and in line numbers. */
export type FenceOrigin = { start: number; lineStart: number };

const TOKEN = /\{md-origin=(\d+):(\d+)\}/u;

function tokenOf(block: MdBlock): string {
  return ` {md-origin=${block.codeStart}:${block.span.lineStart + 1}}`;
}

/** A section slice with each fence's origin appended to its info string. */
export function withFenceOrigins(slice: string, sliceStart: number, blocks: readonly MdBlock[]): string {
  const fenced = blocks
    .filter((block) => block.kind === "code" && block.language !== undefined && block.codeStart !== undefined)
    .sort((left, right) => left.codeStart! - right.codeStart!);
  let marked = slice;
  let shift = 0;
  for (const block of fenced) {
    // codeStart sits just past the opening fence line, so the token goes before
    // that line's newline. A slice that does not carry the fence is skipped.
    const at = block.codeStart! - 1 - sliceStart + shift;
    if (marked[at] !== "\n") continue;
    const token = tokenOf(block);
    marked = marked.slice(0, at) + token + marked.slice(at);
    shift += token.length;
  }
  return marked;
}

/** The origin a fenced renderer reads back out of its metastring. */
export function fenceOriginOf(meta: string | undefined): FenceOrigin | undefined {
  const match = meta ? TOKEN.exec(meta) : null;
  if (!match) return undefined;
  return { start: Number(match[1]), lineStart: Number(match[2]) };
}

/** Fence-relative spans are what the language adapters produce; add the origin
 * to place them in the file. */
export function absoluteSpan(span: SourceSpan, origin: FenceOrigin): SourceSpan {
  const lineDelta = origin.lineStart - 1;
  return {
    start: span.start + origin.start,
    end: span.end + origin.start,
    lineStart: span.lineStart + lineDelta,
    lineEnd: span.lineEnd + lineDelta,
  };
}
