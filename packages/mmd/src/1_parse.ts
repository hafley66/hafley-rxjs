import type {
  MermaidActivationStatement,
  MermaidDiagnostic,
  MermaidGroupStatement,
  MermaidMessageStatement,
  MermaidNoteStatement,
  MermaidParticipant,
  MermaidSequenceDocument,
  MermaidSourceSpan,
  MermaidStatement,
} from "./0_types"

type SourceLine = {
  text: string
  start: number
  end: number
  line: number
}

const groupForms = new Set(["loop", "alt", "opt", "par", "critical", "break", "rect"] as const)

function sourceLines(source: string): SourceLine[] {
  const lines: SourceLine[] = []
  let start = 0

  for (const [index, text] of source.split("\n").entries()) {
    lines.push({ text, start, end: start + text.length, line: index + 1 })
    start += text.length + 1
  }

  return lines
}

function lineSpan(line: SourceLine): MermaidSourceSpan {
  const leadingWhitespace = line.text.length - line.text.trimStart().length
  const trailingWhitespace = line.text.length - line.text.trimEnd().length

  return {
    start: line.start + leadingWhitespace,
    end: line.end - trailingWhitespace,
    lineStart: line.line,
    lineEnd: line.line,
  }
}

function groupSpan(start: MermaidSourceSpan, end: MermaidSourceSpan): MermaidSourceSpan {
  return {
    start: start.start,
    end: end.end,
    lineStart: start.lineStart,
    lineEnd: end.lineEnd,
  }
}

function diagnostic(
  code: MermaidDiagnostic["code"],
  message: string,
  sourceSpan: MermaidSourceSpan,
): MermaidDiagnostic {
  return { code, message, sourceSpan }
}

function currentStatements(roots: MermaidStatement[], groups: MermaidGroupStatement[]): MermaidStatement[] {
  return groups.at(-1)?.statements ?? roots
}

/**
 * Parses the sequence-diagram subset into source-local nodes. The Mermaid
 * runtime validates the complete grammar separately from this document layer.
 */
export function parseMermaidSequence(source: string): MermaidSequenceDocument {
  const participants: MermaidParticipant[] = []
  const statements: MermaidStatement[] = []
  const diagnostics: MermaidDiagnostic[] = []
  const groups: MermaidGroupStatement[] = []
  let statementOrdinal = 0

  for (const line of sourceLines(source)) {
    const text = line.text.trim()

    if (!text || text.startsWith("%%")) {
      continue
    }

    const span = lineSpan(line)

    if (text === "sequenceDiagram") {
      continue
    }

    const participant = /^(participant|actor)\s+([A-Za-z_][\w-]*)(?:\s+as\s+(.+))?$/.exec(text)

    if (participant) {
      participants.push({
        kind: "participant",
        key: `participant:${participant[2]}#${participants.length}`,
        form: participant[1] as MermaidParticipant["form"],
        id: participant[2],
        label: participant[3] ?? participant[2],
        ordinal: participants.length,
        sourceSpan: span,
      })
      continue
    }

    const group = /^(loop|alt|opt|par|critical|break|rect)(?:\s+(.+))?$/.exec(text)

    if (group && groupForms.has(group[1] as MermaidGroupStatement["form"])) {
      const statement: MermaidGroupStatement = {
        kind: "group",
        key: `group:${group[1]}:${group[2] ?? ""}#${statementOrdinal}`,
        form: group[1] as MermaidGroupStatement["form"],
        label: group[2] ?? "",
        ordinal: statementOrdinal++,
        sourceSpan: span,
        statements: [],
      }
      currentStatements(statements, groups).push(statement)
      groups.push(statement)
      continue
    }

    if (text === "end") {
      const groupToClose = groups.pop()

      if (!groupToClose) {
        diagnostics.push(diagnostic("MERMAID_UNMATCHED_END", `line ${line.line}: end has no open group`, span))
      } else {
        groupToClose.sourceSpan = groupSpan(groupToClose.sourceSpan, span)
      }
      continue
    }

    const activation = /^(activate|deactivate)\s+([A-Za-z_][\w-]*)$/.exec(text)

    if (activation) {
      const statement: MermaidActivationStatement = {
        kind: "activation",
        key: `activation:${activation[1]}:${activation[2]}#${statementOrdinal}`,
        action: activation[1] as MermaidActivationStatement["action"],
        target: activation[2],
        ordinal: statementOrdinal++,
        sourceSpan: span,
      }
      currentStatements(statements, groups).push(statement)
      continue
    }

    const note = /^Note\s+(left of|right of|over)\s+([A-Za-z_][\w-]*)(?:\s*,\s*[A-Za-z_][\w-]*)?\s*:\s*(.*)$/.exec(text)

    if (note) {
      const statement: MermaidNoteStatement = {
        kind: "note",
        key: `note:${note[1]}:${note[2]}:${note[3]}#${statementOrdinal}`,
        placement: note[1] as MermaidNoteStatement["placement"],
        target: note[2],
        label: note[3],
        ordinal: statementOrdinal++,
        sourceSpan: span,
      }
      currentStatements(statements, groups).push(statement)
      continue
    }

    const message = /^([A-Za-z_][\w-]*)\s*(-->>|->>|-->|->|--x|->x)\s*([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(text)

    if (message) {
      const statement: MermaidMessageStatement = {
        kind: "message",
        key: `message:${message[1]}${message[2]}${message[3]}:${message[4]}#${statementOrdinal}`,
        from: message[1],
        arrow: message[2],
        to: message[3],
        label: message[4],
        ordinal: statementOrdinal++,
        sourceSpan: span,
      }
      currentStatements(statements, groups).push(statement)
      continue
    }

    diagnostics.push(
      diagnostic("MERMAID_UNSUPPORTED_STATEMENT", `line ${line.line}: unsupported sequence statement`, span),
    )
  }

  if (!sourceLines(source).some(line => line.text.trim() === "sequenceDiagram")) {
    diagnostics.unshift(
      diagnostic("MERMAID_MISSING_SEQUENCE_DIAGRAM", "line 1: expected sequenceDiagram", {
        start: 0,
        end: 0,
        lineStart: 1,
        lineEnd: 1,
      }),
    )
  }

  for (const group of groups) {
    diagnostics.push(
      diagnostic(
        "MERMAID_UNCLOSED_GROUP",
        `line ${group.sourceSpan.lineStart}: ${group.form} has no closing end`,
        group.sourceSpan,
      ),
    )
  }

  return { language: "mermaid", participants, statements, diagnostics }
}
