export type D2SourceSpan = {
  start: number
  end: number
  lineStart: number
  lineEnd: number
}

export type D2Diagnostic = {
  code: "D2_UNMATCHED_CLOSE" | "D2_UNCLOSED_GROUP" | "D2_UNSUPPORTED_STATEMENT"
  message: string
  sourceSpan: D2SourceSpan
}

export type D2Actor = {
  kind: "actor"
  key: string
  id: string
  label: string
  ordinal: number
  sourceSpan: D2SourceSpan
}

export type D2Endpoint = {
  actor: string
  span?: string
  sourceSpan: D2SourceSpan
}

export type D2Edge = {
  kind: "edge"
  key: string
  source: D2Endpoint
  target: D2Endpoint
  label: string
  ordinal: number
  parentGroupKey?: string
  sourceSpan: D2SourceSpan
}

export type D2Span = {
  kind: "span"
  key: string
  actor: string
  name: string
  ordinal: number
  parentGroupKey?: string
  sourceSpan: D2SourceSpan
}

export type D2Note = {
  kind: "note"
  key: string
  actor: string
  label: string
  ordinal: number
  parentGroupKey?: string
  sourceSpan: D2SourceSpan
}

export type D2Directive = {
  kind: "directive"
  key: string
  property: string
  value: string
  ordinal: number
  sourceSpan: D2SourceSpan
}

export type D2Group = {
  kind: "group"
  key: string
  label: string
  ordinal: number
  parentGroupKey?: string
  sourceSpan: D2SourceSpan
  statements: D2Statement[]
}

export type D2Statement = D2Edge | D2Note | D2Directive | D2Group

export type D2SequenceDocument = {
  language: "d2"
  actors: D2Actor[]
  edges: D2Edge[]
  groups: D2Group[]
  spans: D2Span[]
  notes: D2Note[]
  directives: D2Directive[]
  statements: D2Statement[]
  diagnostics: D2Diagnostic[]
}
