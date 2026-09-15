// Offsets are absolute into the source text a caller parsed. Lines are 1-based.
// Every source language shares this span, so identity code does not need to know
// which parser produced it.
export type SourceSpan = {
  start: number
  end: number
  lineStart: number
  lineEnd: number
}
