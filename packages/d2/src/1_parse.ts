import type {
  D2Actor,
  D2Diagnostic,
  D2Directive,
  D2Edge,
  D2Endpoint,
  D2Group,
  D2Note,
  D2SequenceDocument,
  D2SourceSpan,
  D2Span,
  D2Statement,
} from "./0_types"

type SourceLine = {
  text: string
  start: number
  end: number
  line: number
}

function sourceLines(source: string): SourceLine[] {
  const lines: SourceLine[] = []
  let start = 0

  for (const [index, text] of source.split("\n").entries()) {
    lines.push({ text, start, end: start + text.length, line: index + 1 })
    start += text.length + 1
  }

  return lines
}

function lineSpan(line: SourceLine): D2SourceSpan {
  const leadingWhitespace = line.text.length - line.text.trimStart().length
  const trailingWhitespace = line.text.length - line.text.trimEnd().length

  return {
    start: line.start + leadingWhitespace,
    end: line.end - trailingWhitespace,
    lineStart: line.line,
    lineEnd: line.line,
  }
}

function groupSpan(start: D2SourceSpan, end: D2SourceSpan): D2SourceSpan {
  return {
    start: start.start,
    end: end.end,
    lineStart: start.lineStart,
    lineEnd: end.lineEnd,
  }
}

function diagnostic(code: D2Diagnostic["code"], message: string, sourceSpan: D2SourceSpan): D2Diagnostic {
  return { code, message, sourceSpan }
}

function currentStatements(roots: D2Statement[], groups: D2Group[]): D2Statement[] {
  return groups.at(-1)?.statements ?? roots
}

function endpoint(value: string, start: number, line: SourceLine): D2Endpoint {
  const [actor, span] = value.split(".")

  return {
    actor,
    ...(span ? { span } : {}),
    sourceSpan: {
      start,
      end: start + value.length,
      lineStart: line.line,
      lineEnd: line.line,
    },
  }
}

/**
 * Parses the D2 sequence-diagram source forms used by the checked fixture.
 * The D2 0.7.1 CLI exposes rendering, formatting, and validation, with no
 * serialized AST API; unsupported syntax remains a diagnostic.
 */
export function parseD2Sequence(source: string): D2SequenceDocument {
  const actors: D2Actor[] = []
  const edges: D2Edge[] = []
  const groups: D2Group[] = []
  const spans: D2Span[] = []
  const notes: D2Note[] = []
  const directives: D2Directive[] = []
  const statements: D2Statement[] = []
  const diagnostics: D2Diagnostic[] = []
  const openGroups: D2Group[] = []
  const seenSpans = new Set<string>()
  let statementOrdinal = 0

  for (const line of sourceLines(source)) {
    const text = line.text.trim()

    if (!text || text.startsWith("#")) {
      continue
    }

    const span = lineSpan(line)

    if (text === "}") {
      const group = openGroups.pop()

      if (!group) {
        diagnostics.push(diagnostic("D2_UNMATCHED_CLOSE", `line ${line.line}: } has no open group`, span))
      } else {
        group.sourceSpan = groupSpan(group.sourceSpan, span)
      }
      continue
    }

    const group = /^(.+?):\s*\{$/.exec(text)

    if (group) {
      const parentGroupKey = openGroups.at(-1)?.key
      const item: D2Group = {
        kind: "group",
        key: `group:${group[1]}#${groups.length}`,
        label: group[1],
        ordinal: statementOrdinal++,
        ...(parentGroupKey ? { parentGroupKey } : {}),
        sourceSpan: span,
        statements: [],
      }
      currentStatements(statements, openGroups).push(item)
      groups.push(item)
      openGroups.push(item)
      continue
    }

    const directive = /^([A-Za-z_][\w.-]*):\s*(.+)$/.exec(text)

    if (directive && openGroups.length === 0 && directive[1] === "shape") {
      const item: D2Directive = {
        kind: "directive",
        key: `directive:${directive[1]}#${directives.length}`,
        property: directive[1],
        value: directive[2],
        ordinal: statementOrdinal++,
        sourceSpan: span,
      }
      directives.push(item)
      statements.push(item)
      continue
    }

    const note = /^([A-Za-z_][\w-]*)\."(.*)"$/.exec(text)

    if (note) {
      const parentGroupKey = openGroups.at(-1)?.key
      const item: D2Note = {
        kind: "note",
        key: `note:${note[1]}:${note[2]}#${statementOrdinal}`,
        actor: note[1],
        label: note[2],
        ordinal: statementOrdinal++,
        ...(parentGroupKey ? { parentGroupKey } : {}),
        sourceSpan: span,
      }
      notes.push(item)
      currentStatements(statements, openGroups).push(item)
      continue
    }

    const edge =
      /^([A-Za-z_][\w-]*(?:\.[A-Za-z_][\w-]*)?)\s*->\s*([A-Za-z_][\w-]*(?:\.[A-Za-z_][\w-]*)?)\s*:\s*(.*)$/.exec(text)

    if (edge) {
      const sourceOffset = line.start + line.text.indexOf(edge[1])
      const targetOffset = line.start + line.text.indexOf(edge[2], line.text.indexOf("->") + 2)
      const parentGroupKey = openGroups.at(-1)?.key
      const item: D2Edge = {
        kind: "edge",
        key: `edge:${edge[1]}->${edge[2]}:${edge[3]}#${statementOrdinal}`,
        source: endpoint(edge[1], sourceOffset, line),
        target: endpoint(edge[2], targetOffset, line),
        label: edge[3],
        ordinal: statementOrdinal++,
        ...(parentGroupKey ? { parentGroupKey } : {}),
        sourceSpan: span,
      }
      edges.push(item)
      currentStatements(statements, openGroups).push(item)

      for (const side of [item.source, item.target]) {
        if (!side.span) {
          continue
        }

        const key = `${side.actor}.${side.span}`

        if (!seenSpans.has(key)) {
          seenSpans.add(key)
          const spanItem: D2Span = {
            kind: "span",
            key: `span:${key}#${spans.length}`,
            actor: side.actor,
            name: side.span,
            ordinal: spans.length,
            ...(parentGroupKey ? { parentGroupKey } : {}),
            sourceSpan: side.sourceSpan,
          }
          spans.push(spanItem)
        }
      }
      continue
    }

    const actor = /^([A-Za-z_][\w-]*):\s*(.+)$/.exec(text)

    if (actor && openGroups.length === 0) {
      actors.push({
        kind: "actor",
        key: `actor:${actor[1]}#${actors.length}`,
        id: actor[1],
        label: actor[2],
        ordinal: actors.length,
        sourceSpan: span,
      })
      continue
    }

    diagnostics.push(
      diagnostic("D2_UNSUPPORTED_STATEMENT", `line ${line.line}: unsupported D2 sequence statement`, span),
    )
  }

  for (const group of openGroups) {
    diagnostics.push(
      diagnostic(
        "D2_UNCLOSED_GROUP",
        `line ${group.sourceSpan.lineStart}: ${group.label} has no closing }`,
        group.sourceSpan,
      ),
    )
  }

  return {
    language: "d2",
    actors,
    edges,
    groups,
    spans,
    notes,
    directives,
    statements,
    diagnostics,
  }
}
