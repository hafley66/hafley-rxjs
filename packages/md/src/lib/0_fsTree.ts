// `tree` output, `ls -R` sections, `find` paths, and indented path lists -> one model.
// The tree need not exist on disk: the model is only what the text says.

export type FsTreeFormat = "tree" | "ls" | "find" | "indent";

export interface FsTreeNode {
  readonly name: string;
  /** Ancestor names and this name joined by `/`. Unique within one parse: a repeated path merges. */
  readonly path: string;
  /** `dir` when the node has children or its name was written with a trailing `/`. */
  readonly kind: "dir" | "file";
  /** Text after `  #` on a `tree` or indented line. */
  readonly note?: string;
  readonly children: readonly FsTreeNode[];
}

export interface FsTree {
  readonly format: FsTreeFormat;
  readonly roots: readonly FsTreeNode[];
}

interface Draft {
  name: string;
  path: string;
  dir: boolean;
  note?: string;
  children: Draft[];
}

const CONNECTOR = /[├└]─+ ?|[|`]--+ ?/u;
const TREE_RULE_ONLY = /^[\s│|]*$/u;
const TREE_SUMMARY = /^\d+ director(?:y|ies)(?:, \d+ files?)?$/u;
const LS_HEADER = /^(\S.*):$/u;
const LIST_MARKER = /^[-*+]\s+/u;
const NOTE = /\s+#\s*/u;

/** The child of `siblings` named `name`, created when absent. `dir` only ever upgrades. */
function childOf(siblings: Draft[], parentPath: string | undefined, name: string, dir: boolean, note?: string): Draft {
  const found = siblings.find((it) => it.name === name);
  if (found !== undefined) {
    found.dir ||= dir;
    found.note ??= note;
    return found;
  }
  const made: Draft = { name, path: parentPath === undefined ? name : `${parentPath}/${name}`, dir, children: [] };
  if (note !== undefined) made.note = note;
  siblings.push(made);
  return made;
}

/** `name/  # note` -> its parts. The trailing `/` is the dir hint and leaves the name. */
function entryOf(text: string, notes: boolean): { name: string; dir: boolean; note?: string } {
  const noteAt = notes ? NOTE.exec(text) : null;
  const note = noteAt === null ? undefined : text.slice(noteAt.index + noteAt[0].length).trim() || undefined;
  const raw = (noteAt === null ? text : text.slice(0, noteAt.index)).trim();
  const dir = raw.endsWith("/") && raw.length > 1;
  const name = dir ? raw.replace(/\/+$/u, "") : raw;
  return note === undefined ? { name, dir } : { name, dir, note };
}

/** Indentation-positioned entries: a line nests under the nearest earlier line at a smaller column. */
function byColumn(entries: readonly { col: number; text: string }[]): Draft[] {
  const roots: Draft[] = [];
  const stack: { col: number; node: Draft }[] = [];
  for (const { col, text } of entries) {
    const entry = entryOf(text, true);
    if (entry.name === "") continue;
    while (stack.length > 0 && stack[stack.length - 1]!.col >= col) stack.pop();
    const parent = stack[stack.length - 1]?.node;
    const node = childOf(parent?.children ?? roots, parent?.path, entry.name, entry.dir, entry.note);
    stack.push({ col, node });
  }
  return roots;
}

/** Path-positioned entries: each segment list is walked from the roots. */
function byPath(paths: readonly { segments: readonly string[]; dir: boolean }[]): Draft[] {
  const roots: Draft[] = [];
  for (const { segments, dir } of paths) {
    let siblings = roots;
    let parentPath: string | undefined;
    segments.forEach((segment, index) => {
      const node = childOf(siblings, parentPath, segment, dir || index < segments.length - 1);
      siblings = node.children;
      parentPath = node.path;
    });
  }
  return roots;
}

/** `./src/lib/` -> `["src", "lib"]`. `.` and empty segments are structure, not names. */
const segmentsOf = (path: string): string[] => path.split("/").filter((it) => it !== "" && it !== ".");

function parseTree(lines: readonly string[]): Draft[] {
  const entries: { col: number; text: string }[] = [];
  for (const line of lines) {
    if (TREE_RULE_ONLY.test(line) || TREE_SUMMARY.test(line.trim())) continue;
    const connector = CONNECTOR.exec(line);
    entries.push(connector === null
      ? { col: -1, text: line }
      : { col: connector.index, text: line.slice(connector.index + connector[0].length) });
  }
  return byColumn(entries);
}

function parseLs(lines: readonly string[]): Draft[] {
  const paths: { segments: string[]; dir: boolean }[] = [];
  let base: string[] = [];
  for (const line of lines) {
    if (line.trim() === "" || /^total \d+$/u.test(line.trim())) continue;
    const header = LS_HEADER.exec(line);
    if (header !== null) {
      base = segmentsOf(header[1]!);
      if (base.length > 0) paths.push({ segments: base, dir: true });
      continue;
    }
    for (const cell of line.trim().split(/\t+|\s{2,}/u)) {
      const entry = entryOf(cell, false);
      if (entry.name !== "") paths.push({ segments: [...base, entry.name], dir: entry.dir });
    }
  }
  return byPath(paths);
}

function parseFind(lines: readonly string[]): Draft[] {
  return byPath(lines
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .map((line) => ({ segments: segmentsOf(line), dir: line.endsWith("/") }))
    .filter((it) => it.segments.length > 0));
}

function parseIndent(lines: readonly string[]): Draft[] {
  return byColumn(lines
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const col = line.length - line.trimStart().length;
      return { col, text: line.trimStart().replace(LIST_MARKER, "") };
    }));
}

function formatOf(lines: readonly string[]): FsTreeFormat {
  const filled = lines.filter((line) => line.trim() !== "");
  if (filled.some((line) => CONNECTOR.test(line))) return "tree";
  if (filled.some((line) => LS_HEADER.test(line))) return "ls";
  if (filled.every((line) => line === line.trimStart()) && filled.some((line) => /\/[^/\s]/u.test(line))) return "find";
  return "indent";
}

const PARSERS: Record<FsTreeFormat, (lines: readonly string[]) => Draft[]> = {
  tree: parseTree,
  ls: parseLs,
  find: parseFind,
  indent: parseIndent,
};

const freeze = (draft: Draft): FsTreeNode => {
  const node = {
    name: draft.name,
    path: draft.path,
    kind: draft.dir || draft.children.length > 0 ? "dir" as const : "file" as const,
    children: draft.children.map(freeze),
  };
  return draft.note === undefined ? node : { ...node, note: draft.note };
};

export function parseFsTree(text: string): FsTree {
  const lines = text.replace(/\r\n?/gu, "\n").split("\n");
  const format = formatOf(lines);
  return { format, roots: PARSERS[format](lines).map(freeze) };
}
