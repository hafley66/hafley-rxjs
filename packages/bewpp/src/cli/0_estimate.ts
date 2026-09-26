/** Bytes of a UTF-8 string, the only unit the allocator and estimator agree on. */
export function byteLength(text: string): number {
  return Buffer.byteLength(text, "utf8")
}

/** Token estimate used everywhere in this CLI: no tokenizer dependency. */
export function estimateTokens(bytes: number): number {
  return Math.ceil(bytes / 4)
}
