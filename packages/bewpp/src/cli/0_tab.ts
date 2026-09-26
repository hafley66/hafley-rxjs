export type TabArg = { kind: "active" } | { kind: "id"; id: string }

/** Mirrors the bash reference's `tab()` classifier, including the `"0"` falsy trap it avoids. */
export function classifyTabArg(raw: string | undefined): TabArg {
  const value = raw ?? ""
  if (value === "" || value === "." || value === "cur" || value === "current") return { kind: "active" }
  if (/^[0-9]+$/.test(value)) return { kind: "id", id: value }
  throw new Error("tab must be a numeric id from 'bew tabs', or '.' for the active tab")
}
