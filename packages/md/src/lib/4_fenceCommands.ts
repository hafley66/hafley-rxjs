// The command pre-pass: fence text goes to a host runner, its output is spliced
// back into the section's markdown before any renderer sees it.
import { catchError, combineLatest, distinctUntilChanged, EMPTY, filter, map, of, startWith, take, type Observable } from "rxjs";
import { unified } from "unified";
import remarkParse from "remark-parse";
import type { Nodes } from "mdast";
import type { MdFenceCommand, MdFenceCommandResult, MdFenceCommandRunner } from "../plugins/0_types.js";

export interface FenceSpan {
  language: string;
  /** Leading whitespace of the fence block, from list nesting. Empty at column one. */
  indent: string;
  /** Body offsets: past the opening fence line, up to the closing fence line. */
  bodyStart: number;
  bodyEnd: number;
  /** End of the closing fence line, before its newline. */
  end: number;
}

export interface FenceEdit {
  at: number;
  remove: number;
  insert: string;
}

export interface FencePass {
  source: string;
  text: string;
  edits: readonly FenceEdit[];
}

/** Advance of the 13px code font, in px. Fallback when no DOM can be measured. */
export const CODE_ADVANCE_PX = 7.8;
const MIN_COLUMNS = 20;

export function fenceColumns(widthPx: number, advancePx: number = CODE_ADVANCE_PX): number {
  return Math.max(MIN_COLUMNS, Math.floor(widthPx / advancePx));
}

const CLOSING_FENCE = /^ {0,3}(?:`{3,}|~{3,})[ \t]*$/u;

function* codeNodes(node: Nodes): Generator<Extract<Nodes, { type: "code" }>> {
  if (node.type === "code") yield node;
  if ("children" in node) for (const child of node.children) yield* codeNodes(child);
}
/** Removes up to one `indent` of leading whitespace from every line. */
function dedent(block: string, indent: string): string {
  if (!indent) return block;
  return block.split("\n").map((line) => {
    let cut = 0;
    while (cut < indent.length && (line[cut] === " " || line[cut] === "\t")) cut += 1;
    return line.slice(cut);
  }).join("\n");
}

/** Restores the fence block's indentation on every non-empty line of an answer. */
function reindent(text: string, indent: string): string {
  if (!indent) return text;
  return text.split("\n").map((line) => (line ? indent + line : line)).join("\n");
}

/**
 * Closed fenced code blocks that carry a language. Fences nested in list items
 * come with their indent; block-quote-prefixed fences are still skipped.
 */
export function fenceSpans(markdown: string): FenceSpan[] {
  const tree = unified().use(remarkParse).parse(markdown);
  const spans: FenceSpan[] = [];
  for (const node of codeNodes(tree)) {
    const start = node.position?.start;
    const end = node.position?.end.offset;
    if (!node.lang || start?.offset === undefined || end === undefined) continue;
    // The opening fence marker sits after the block's indent; anything else
    // prefixing the line (a block quote mark) is not a supported nesting.
    const indent = markdown.slice(markdown.lastIndexOf("\n", start.offset - 1) + 1, start.offset);
    if (!/^[ \t]*$/u.test(indent)) continue;
    const raw = markdown.slice(start.offset, end);
    const firstBreak = raw.indexOf("\n");
    const lastBreak = raw.lastIndexOf("\n");
    if (firstBreak < 0 || !CLOSING_FENCE.test(dedent(raw.slice(lastBreak + 1), indent))) continue;
    const bodyStart = start.offset + firstBreak + 1;
    const bodyEnd = Math.max(bodyStart, start.offset + lastBreak + 1);
    if (dedent(markdown.slice(bodyStart, bodyEnd), indent).replace(/\n$/u, "") !== node.value) continue;
    spans.push({ language: node.lang, indent, bodyStart, bodyEnd, end });
  }
  return spans;
}

function annotation(span: FenceSpan, output: string): FenceEdit[] {
  const body = output.trimEnd();
  if (!body) return [];
  const longest = Math.max(0, ...[...body.matchAll(/`+/gu)].map((run) => run[0].length));
  const fence = "`".repeat(Math.max(3, longest + 1));
  return [{ at: span.end, remove: 0, insert: `\n\n${reindent(`${fence}text\n${body}\n${fence}`, span.indent)}` }];
}

export function fenceEdits(markdown: string, span: FenceSpan, command: MdFenceCommand, result: MdFenceCommandResult): FenceEdit[] {
  if (command.as === "annotate") return annotation(span, result.stdout);
  if (result.code !== 0) return annotation(span, result.stderr);
  const answered = result.stdout.endsWith("\n") || !result.stdout ? result.stdout : `${result.stdout}\n`;
  const insert = reindent(answered, span.indent);
  const remove = span.bodyEnd - span.bodyStart;
  return insert === markdown.slice(span.bodyStart, span.bodyEnd) ? [] : [{ at: span.bodyStart, remove, insert }];
}

export function applyFenceEdits(markdown: string, edits: readonly FenceEdit[]): string {
  return [...edits]
    .sort((left, right) => right.at - left.at)
    .reduce((text, edit) => text.slice(0, edit.at) + edit.insert + text.slice(edit.at + edit.remove), markdown);
}

/** Moves source offsets past the edits that land before them. */
export function shiftOffsets(offsets: readonly number[], edits: readonly FenceEdit[]): readonly number[] {
  if (edits.length === 0) return offsets;
  return offsets.map((offset) => edits
    .filter((edit) => edit.at + edit.remove <= offset)
    .reduce((shifted, edit) => shifted + edit.insert.length - edit.remove, offset));
}

function matcher(command: MdFenceCommand): { command: MdFenceCommand; pattern: RegExp }[] {
  try {
    return [{ command, pattern: new RegExp(command.match, "u") }];
  } catch {
    return [];
  }
}

/**
 * Emits a rewritten section each time a host result lands. Emits nothing when no
 * runner is given, no command matches, or the host has not answered yet.
 */
export function fenceCommandPass(
  markdown: string,
  commands: readonly MdFenceCommand[],
  run: MdFenceCommandRunner | undefined,
  columns: number,
): Observable<FencePass> {
  if (!run || commands.length === 0) return EMPTY;
  const matchers = commands.flatMap(matcher);
  if (matchers.length === 0) return EMPTY;
  const jobs = fenceSpans(markdown).flatMap((span) => {
    const hit = matchers.find(({ pattern }) => pattern.test(span.language));
    if (!hit) return [];
    const text = dedent(markdown.slice(span.bodyStart, span.bodyEnd), span.indent);
    // The answer is re-indented to the fence's indent, so the formatter should
    // wrap inside it: pass the prose width minus the indent.
    const width = Math.max(MIN_COLUMNS, columns - span.indent.length);
    return [run({ command: hit.command.command, language: span.language, text, columns: width }).pipe(
      take(1),
      map((result): FenceEdit[] | null => fenceEdits(markdown, span, hit.command, result)),
      catchError(() => of([])),
      startWith(null),
    )];
  });
  if (jobs.length === 0) return EMPTY;
  return combineLatest(jobs).pipe(
    filter((perFence) => perFence.some((answer) => answer !== null)),
    map((perFence) => {
      const edits = perFence.flatMap((answer) => answer ?? []);
      return { source: markdown, text: applyFenceEdits(markdown, edits), edits };
    }),
    distinctUntilChanged((left, right) => left.text === right.text),
  );
}
