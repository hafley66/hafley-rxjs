import type { LocatorQuery } from "./0_controls.js"

/**
 * Text matching, escaped the way Playwright's `stringUtils` escapes it: the JSON form of the string
 * plus `s` for exact matching or `i` for case-insensitive substring matching.
 */
function escapeForText(text: string, exact: boolean) {
  return `${JSON.stringify(text)}${exact ? "s" : "i"}`
}

/** Attribute matching, escaped the way Playwright's `stringUtils` escapes it. */
function escapeForAttribute(value: string, exact: boolean) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"${exact ? "s" : "i"}`
}

/**
 * The Playwright selector a locator query stands for. `selector` is Playwright syntax already and
 * passes through untouched; every other kind compiles to the `internal:` engine that Playwright's own
 * `getBy*` compiles to, so resolution order, strictness, and error text belong to the injected engine.
 *
 * Composition mirrors Playwright's: `within` chains (`parent >> child`), `has` and `visible` are
 * filters, and `last`/`index` are applied to the filtered set.
 */
export function playwrightSelector(query: LocatorQuery): string {
  const parts: string[] = []
  if (query.within) parts.push(playwrightSelector(query.within))
  if (query.role) {
    const name = query.name === undefined ? "" : `[name=${escapeForAttribute(query.name, query.exact ?? false)}]`
    parts.push(`internal:role=${query.role}${name}`)
  } else if (query.label !== undefined) parts.push(`internal:label=${escapeForText(query.label, query.exact ?? false)}`)
  else if (query.placeholder !== undefined)
    parts.push(`internal:attr=[placeholder=${escapeForAttribute(query.placeholder, query.exact ?? false)}]`)
  else if (query.testid !== undefined)
    parts.push(`internal:testid=[data-testid=${escapeForAttribute(query.testid, true)}]`)
  else if (query.selector !== undefined) parts.push(query.selector)
  else throw new Error("A locator must specify role, label, placeholder, test ID, or CSS.")
  if (query.has) parts.push(`internal:has=${JSON.stringify(playwrightSelector(query.has))}`)
  if (query.visible != null) parts.push(`visible=${query.visible}`)
  if (query.last) parts.push("nth=-1")
  else if (query.index != null) parts.push(`nth=${query.index}`)
  return parts.join(" >> ")
}
