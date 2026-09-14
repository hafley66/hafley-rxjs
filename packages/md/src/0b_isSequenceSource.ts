export type DiagramLanguage = "mermaid" | "d2";

// A mermaid fence may open with YAML frontmatter, `%%{init: ...}%%` directives,
// and `%% ...` comments before the diagram keyword.
function mermaidKeywordLine(code: string): string {
  const lines = code.split(/\r?\n/);
  let index = 0;
  while (index < lines.length && lines[index].trim() === "") index += 1;
  if (lines[index]?.trim() === "---") {
    index += 1;
    while (index < lines.length && lines[index].trim() !== "---") index += 1;
    index += 1;
  }
  while (index < lines.length) {
    const line = lines[index].trim();
    if (line === "") {
      index += 1;
      continue;
    }
    if (!line.startsWith("%%")) return line;
    // A directive may span lines; it closes at the first `}%%`.
    if (line.startsWith("%%{") && !line.includes("}%%")) {
      while (index < lines.length && !lines[index].includes("}%%")) index += 1;
    }
    index += 1;
  }
  return "";
}

export function isSequenceSource(language: DiagramLanguage, code: string): boolean {
  if (language === "d2") return /(^|[\s;{])shape\s*:\s*sequence_diagram\b/.test(code);
  return /^sequenceDiagram\b/.test(mermaidKeywordLine(code));
}
