export type MermaidSourceSpan = {
  start: number
  end: number
  lineStart: number
  lineEnd: number
}

export type MermaidDiagnostic = {
  code:
    | "MERMAID_MISSING_SEQUENCE_DIAGRAM"
    | "MERMAID_UNMATCHED_END"
    | "MERMAID_UNCLOSED_GROUP"
    | "MERMAID_UNSUPPORTED_STATEMENT"
  message: string
  sourceSpan: MermaidSourceSpan
}

export type MermaidParticipant = {
  kind: "participant"
  key: string
  form: "participant" | "actor"
  id: string
  label: string
  ordinal: number
  sourceSpan: MermaidSourceSpan
}

export type MermaidMessageStatement = {
  kind: "message"
  key: string
  from: string
  to: string
  arrow: string
  label: string
  ordinal: number
  sourceSpan: MermaidSourceSpan
}

export type MermaidActivationStatement = {
  kind: "activation"
  key: string
  action: "activate" | "deactivate"
  target: string
  ordinal: number
  sourceSpan: MermaidSourceSpan
}

export type MermaidNoteStatement = {
  kind: "note"
  key: string
  placement: "left of" | "right of" | "over"
  target: string
  label: string
  ordinal: number
  sourceSpan: MermaidSourceSpan
}

export type MermaidGroupStatement = {
  kind: "group"
  key: string
  form: "loop" | "alt" | "opt" | "par" | "critical" | "break" | "rect"
  label: string
  ordinal: number
  sourceSpan: MermaidSourceSpan
  statements: MermaidStatement[]
}

export type MermaidStatement =
  | MermaidMessageStatement
  | MermaidActivationStatement
  | MermaidNoteStatement
  | MermaidGroupStatement

export type MermaidSequenceDocument = {
  language: "mermaid"
  participants: MermaidParticipant[]
  statements: MermaidStatement[]
  diagnostics: MermaidDiagnostic[]
}
