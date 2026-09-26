/** Playwright's InjectedScript surface this extension calls. */
export type Engine = {
  parseSelector(selector: string): unknown
  querySelector(parsed: unknown, root: Node, strict: boolean): Element | undefined
  querySelectorAll(parsed: unknown, root: Node): Element[]
  generateSelectorSimple(element: Element, options: object): string
}

let engine: Engine | null | undefined
/** The Playwright engine engine.js loaded into this isolated world; the page cannot see or replace it. */
export function bundledEngine(): Engine | null {
  if (engine !== undefined) return engine
  const Engine = (globalThis as { __bewppEngineClass?: new (window: Window, options: object) => Engine }).__bewppEngineClass
  engine = Engine
    ? new Engine(window, {
        isUnderTest: false,
        sdkLanguage: "javascript",
        frameSeq: 0,
        testIdAttributeName: "data-testid",
        stableRafCount: 1,
        browserName: "chromium",
        isUtilityWorld: true,
        customEngines: [],
      })
    : null
  return engine
}
