// Inline code that cites a file: `src/a.rs:790-801`, `2_call.rs:561,583`,
// `crates/boop-harness`. Shape only; the host resolves the path.

const LINE_SUFFIX = /:\d+(?:-\d+|(?:,\s?\d+)+)?$/
const PATH_CHARS = /^[\w@.+~\-/]+$/
const FILE_EXTENSIONS = new Set([
  "c", "cc", "cjs", "cpp", "css", "d2", "dl6", "el", "gd", "go", "h", "hpp", "html", "java", "js", "json",
  "jsonl", "jsx", "kt", "lisp", "lock", "lua", "md", "mdx", "mjs", "mmd", "nix", "pl", "py", "rb", "rs",
  "scm", "sh", "sql", "svg", "swift", "toml", "ts", "tsx", "txt", "yaml", "yml", "zig",
])

export function isCodeRef(text: string): boolean {
  const line = text.match(LINE_SUFFIX)
  const path = line ? text.slice(0, line.index) : text
  if (!PATH_CHARS.test(path) || path.startsWith("-") || /^[a-z]+:\/\//i.test(path)) return false
  if (path.includes("/")) return /[\w]/.test(path)
  const dot = path.lastIndexOf(".")
  const extension = dot > 0 ? path.slice(dot + 1).toLowerCase() : ""
  return line !== null ? extension !== "" : FILE_EXTENSIONS.has(extension)
}
