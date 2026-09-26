export type Control = Record<string, unknown>
export type Grade = "+" | "~" | "-"

const TAG_ABBREVIATIONS: Record<string, string> = {
  BUTTON: "btn",
  A: "lnk",
  INPUT: "inp",
  TEXTAREA: "txa",
  SELECT: "sel",
}

export function abbreviateTag(tag: string): string {
  return TAG_ABBREVIATIONS[tag] ?? tag.slice(0, 3).toLowerCase()
}

const NAME_FIELDS = ["label", "text", "placeholder", "title"] as const

function stringField(control: Control, field: string): string | undefined {
  const value = control[field]
  return typeof value === "string" && value.length > 0 ? value : undefined
}

export function displayName(control: Control): string {
  for (const field of NAME_FIELDS) {
    const value = stringField(control, field)
    if (value !== undefined) return value.replace(/\s+/g, " ").slice(0, 38)
  }
  return ""
}

export function gradeControl(control: Control): Grade {
  const hasRole = stringField(control, "role") !== undefined
  const hasLabelOrText = stringField(control, "label") !== undefined || stringField(control, "text") !== undefined
  if (hasRole && hasLabelOrText) return "+"
  const hasAnyName = NAME_FIELDS.some(field => stringField(control, field) !== undefined)
  return hasAnyName ? "~" : "-"
}

export function gradeCounts(controls: Control[]): { plus: number; tilde: number; minus: number } {
  const counts = { plus: 0, tilde: 0, minus: 0 }
  for (const control of controls) {
    const grade = gradeControl(control)
    if (grade === "+") counts.plus++
    else if (grade === "~") counts.tilde++
    else counts.minus++
  }
  return counts
}
