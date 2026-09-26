import type { Terminal } from "@xterm/xterm";
import type { ProjectedTurnRegion } from "./0_turnRegions.js";

export type DiagramLanguage = "mermaid" | "d2";
export type DiagramFence = {
  language: DiagramLanguage;
  code: string;
  start: number;
  end: number;
  inferred: boolean;
  stripped?: boolean;
  locator?: string;
  messageId?: string;
};
type LogicalLine = { text: string; start: number; end: number };
function normalizedDiagramLines(code: string): string[] {
  return code
    .split("\n")
    .map((line) => line.toLowerCase().replace(/^\s*[•●]\s?/, "").replace(/\s+/g, " ").trim())
    .filter((line) => /[a-z0-9]/.test(line) && line.length >= 4);
}
export type TerminalDiagramLayout = {
  maxViewportHeightRatio: number;
  maxBlankRows: number;
};
export const defaultTerminalDiagramLayout: TerminalDiagramLayout = {
  maxViewportHeightRatio: 0.45,
  maxBlankRows: 18,
};
function logicalLines(term: Terminal, from: number, through: number): LogicalLine[] {
  const buffer = term.buffer.active;
  const lines: LogicalLine[] = [];
  let current: LogicalLine | null = null;
  for (let row = from; row <= through; row++) {
    const line = buffer.getLine(row);
    if (!line) continue;
    const continued = buffer.getLine(row + 1)?.isWrapped ?? false;
    const text = line.translateToString(!continued);
    if (line.isWrapped && current) {
      current.text += text;
      current.end = row;
    } else {
      current = { text, start: row, end: row };
      lines.push(current);
    }
  }
  return lines;
}

// What the terminal overlay treats as a diagram: only ``` fences, also a
// stripped fence whose language label survived as its own row, or also an
// unlabeled body that opens with a diagram keyword.
export const DIAGRAM_INFERENCE = ["explicit", "labels", "inferred"] as const;
export type DiagramInference = (typeof DIAGRAM_INFERENCE)[number];

export function findDiagramFences(term: Terminal, inference: DiagramInference = "inferred"): DiagramFence[] {
  const buffer = term.buffer.active;
  const viewportTop = buffer.viewportY;
  const lines = logicalLines(
    term,
    Math.max(0, viewportTop - 1000),
    Math.min(buffer.length - 1, viewportTop + term.rows + 1000),
  );
  const found: DiagramFence[] = [];
  const occupied = new Set<number>();
  for (let index = 0; index < lines.length; index++) {
    // tmux paints its copy-mode indicator, `[12/340]`, into the right edge of
    // the top row; a fence that lands there still reads as a fence.
    const open = lines[index].text.match(/^\s*(`{3,}|~{3,})\s*(mermaid|d2)\s*(?:\[\d+\/\d+\])?\s*$/i);
    if (!open) continue;
    for (let closeIndex = index + 1; closeIndex < lines.length; closeIndex++) {
      const close = lines[closeIndex].text.match(/^\s*(`{3,}|~{3,})\s*(?:\[\d+\/\d+\])?\s*$/);
      if (!close || close[1][0] !== open[1][0] || close[1].length < open[1].length) continue;
      found.push({
        language: open[2].toLowerCase() as DiagramLanguage,
        code: lines.slice(index + 1, closeIndex).map((line) => line.text).join("\n"),
        start: lines[index].start,
        end: lines[closeIndex].end,
        inferred: false,
      });
      for (let row = lines[index].start; row <= lines[closeIndex].end; row++) occupied.add(row);
      index = closeIndex;
      break;
    }
  }
  if (inference === "explicit") return found;
  // Claude and Codex render Markdown fences without the backticks. The language
  // label survives as its own row, which is enough origin to distinguish a
  // diagram from arrow-shaped source code. Code rows retain Markdown's leading
  // indentation, including across internal blank rows.
  for (let index = 0; index < lines.length; index++) {
    if (occupied.has(lines[index].start)) continue;
    const label = stripTuiBullet(lines[index].text).trim().toLowerCase();
    if (label !== "mermaid" && label !== "d2") continue;
    const firstRaw = stripTuiBullet(lines[index + 1]?.text ?? "");
    const firstCode = firstRaw.trimStart();
    if (label === "mermaid" ? !isMermaidStart(firstCode) : !isD2Start(firstCode)) continue;
    const codeIndent = firstRaw.length - firstCode.length;
    let end = index + 1;
    while (end + 1 < lines.length) {
      const next = stripTuiBullet(lines[end + 1].text);
      const trimmed = next.trim();
      if (!trimmed) {
        // A blank row ends a mermaid block: Claude indents the prose after a
        // stripped fence as deep as its code, so indentation alone let the
        // block run into the next paragraph. A zero-indent block has no other
        // boundary at all. Indented D2 keeps its internal blanks, which
        // separate its declaration groups.
        if (codeIndent === 0 || label === "mermaid") break;
        end++;
        continue;
      }
      if (next.length - next.trimStart().length < codeIndent) break;
      if (endsStrippedBlock(lines[end + 1].text)) break;
      // A fresh language label opens the next diagram rather than continuing this one.
      const nextLabel = trimmed.toLowerCase();
      if (nextLabel === "mermaid" || nextLabel === "d2") break;
      end++;
    }
    const block = lines.slice(index + 1, end + 1);
    found.push({
      language: label,
      code: dedent(block.map((line) => stripTuiBullet(line.text))),
      start: lines[index].start,
      end: lines[end].end,
      inferred: false,
      stripped: true,
    });
    for (let row = lines[index].start; row <= lines[end].end; row++) occupied.add(row);
    index = end;
  }
  if (inference === "labels") return found;
  for (let index = 0; index < lines.length; index++) {
    if (occupied.has(lines[index].start)) continue;
    const first = stripTuiBullet(lines[index].text).trimStart();
    const language: DiagramLanguage | null = isMermaidStart(first)
      ? "mermaid"
      : isD2ArrowLine(first) && isD2ArrowLine(stripTuiBullet(lines[index + 1]?.text ?? "").trimStart())
        ? "d2"
        : null;
    if (!language) continue;
    let end = index;
    if (language === "d2") {
      while (
        end + 1 < lines.length &&
        isD2ArrowLine(stripTuiBullet(lines[end + 1].text).trimStart())
      ) end++;
    } else {
      const indent = lines[index].text.length - lines[index].text.trimStart().length;
      while (end + 1 < lines.length) {
        const next = lines[end + 1].text;
        if (!next.trim() || endsStrippedBlock(next)) break;
        if (next.length - next.trimStart().length < indent) break;
        end++;
      }
    }
    const block = lines.slice(index, end + 1);
    const code = dedent(block.map((line) => stripTuiBullet(line.text)));
    found.push({ language, code, start: block[0].start, end: block[block.length - 1].end, inferred: true });
    index = end;
  }
  return found;
}

export function mergeLocatedDiagrams(direct: DiagramFence[], ledger: DiagramFence[]): DiagramFence[] {
  const fences = [...direct];
  for (const candidate of ledger) {
    const overlapIndex = fences.findIndex((fence) =>
      fence.language === candidate.language &&
      fence.start <= candidate.end &&
      candidate.start <= fence.end
    );
    if (overlapIndex < 0) {
      fences.push(candidate);
      continue;
    }
    const visibleLines = normalizedDiagramLines(fences[overlapIndex].code);
    const ledgerLines = normalizedDiagramLines(candidate.code);
    const visibleIsClippedPrefix = visibleLines.length < ledgerLines.length
      && visibleLines.every((line, index) => line === ledgerLines[index]);
    if (visibleIsClippedPrefix) fences[overlapIndex] = candidate;
  }
  return fences;
}

export function projectedDiagramIsCurrent(
  term: Pick<Terminal, "buffer">,
  region: ProjectedTurnRegion,
): boolean {
  const sourceLines = region.text.split("\n");
  const matchedRows = region.sourceBufferRows?.slice(1, -1) ?? [];
  let currentMatches = 0;
  let comparableRows = 0;
  for (let index = 0; index < matchedRows.length; index++) {
    const row = matchedRows[index];
    if (row === null || row === undefined) continue;
    const source = normalizedDiagramLines(sourceLines[index] ?? "")[0];
    const visible = normalizedDiagramLines(term.buffer.active.getLine(row)?.translateToString(true) ?? "")[0];
    if (!source || !visible) continue;
    comparableRows++;
    if (source === visible || source.includes(visible) || visible.includes(source)) currentMatches++;
  }
  return comparableRows > 0 && currentMatches >= Math.min(2, comparableRows);
}

export function diagramElementKey(fence: DiagramFence, dark: boolean): string {
  // The physical buffer row is positioning data, not identity. A rescan that
  // re-anchors the same logical diagram one row must keep its DOM element, so
  // the key codes the stable turn-scoped locator when present and falls back to
  // a code fingerprint for terminal-only explicit fences that carry no locator.
  const stable = fence.locator ?? `${fence.language}:${normalizedDiagramLines(fence.code).join("\n")}`;
  return `${dark}:${stable}`;
}

function stripTuiBullet(line: string): string {
  return line.replace(/^\s*[•●]\s?/, "");
}

// A fence without backticks has no closer, so the rows a TUI paints after the
// diagram bound it: a box-drawn table or frame (U+2500-U+257F), a bullet (the
// next message's `●`, a list item), or a prompt/composer row.
function endsStrippedBlock(line: string): boolean {
  const text = line.trimStart();
  const first = text.codePointAt(0) ?? 0;
  if (first >= 0x2500 && first <= 0x257f) return true;
  return /^(?:[•●]|[-*>❯›$]\s)/.test(text);
}

function dedent(lines: string[]): string {
  const indents = lines.filter((line) => line.trim()).map((line) => line.match(/^\s*/)?.[0].length ?? 0);
  const margin = indents.length ? Math.min(...indents) : 0;
  return lines.map((line) => line.slice(margin).trimEnd()).join("\n");
}

function isMermaidStart(line: string): boolean {
  return /^(?:flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|gitGraph|mindmap|timeline|quadrantChart|requirementDiagram|C4Context|sankey-beta|xychart-beta)\b/.test(line);
}

function isD2ArrowLine(line: string): boolean {
  if (/\/\/|[;{}]|-->|<--/.test(line)) return false;
  const atom = String.raw`(?:"[^"\n]+"|[A-Za-z_][\w.-]*)`;
  const arrow = String.raw`(?:<?->|<-)`;
  return new RegExp(String.raw`^\s*${atom}(?:\s+${arrow}\s+${atom})+(?:\s*:\s*.+)?\s*$`).test(line);
}

function isD2Start(line: string): boolean {
  return /^(?:direction|classes|vars)\s*:/.test(line) || isD2ArrowLine(line);
}

export function svgAspectRatio(svg: unknown): number | null {
  if (typeof svg !== "string") return null;
  const viewBox = svg.match(/\bviewBox=["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)\s*["']/i);
  if (viewBox) {
    const width = Number(viewBox[1]);
    const height = Number(viewBox[2]);
    if (width > 0 && height > 0) return width / height;
  }
  const width = Number(svg.match(/\bwidth=["']([\d.]+)/i)?.[1]);
  const height = Number(svg.match(/\bheight=["']([\d.]+)/i)?.[1]);
  return width > 0 && height > 0 ? width / height : null;
}

export function diagramElementAtPoint(
  elements: HTMLElement[],
  clientX: number | null,
  clientY: number,
): HTMLElement | null {
  return elements.slice().reverse().find((element) => {
    if (element.hidden) return false;
    const rect = element.getBoundingClientRect();
    return (clientX === null || (rect.left <= clientX && clientX <= rect.right))
      && rect.top <= clientY
      && clientY <= rect.bottom;
  }) ?? null;
}
