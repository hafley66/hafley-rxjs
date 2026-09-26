/** The exact interactive-control selector inspectDocument() uses, so a ref resolves without a round trip. */
export const CONTROL_SELECTOR =
  'a[href], button, input, textarea, select, [role="button"], [role="combobox"], [role="menuitem"], [role="option"], [contenteditable="true"]'

export type LocatorQuery = Record<string, unknown>

/** Locator for the 1-based ref recorded by the last `bew inspect`: same selector, same visible filter, same order. */
export function refLocator(ref: number): LocatorQuery {
  return { selector: CONTROL_SELECTOR, visible: true, index: ref - 1 }
}

export function withScope(query: LocatorQuery, within: LocatorQuery | undefined, has: string | undefined): LocatorQuery {
  const scoped: LocatorQuery = { ...query }
  if (within) scoped.within = within
  if (has !== undefined) scoped.hasText = has
  return scoped
}
