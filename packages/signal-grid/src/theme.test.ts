// One path template is the event route, the test selector, and the CSS hook. That claim is only
// worth making if nothing in the stylesheet targets something the router cannot address, so this
// reads theme.css and holds every selector against what `3_paths.ts` can produce.
import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"
import { TEMPLATES, selectorFor, type PartName } from "./3_paths.js"

const CSS = readFileSync(new URL("./theme.css", import.meta.url), "utf8")

// Every `[data-route="x"]` the stylesheet mentions, in source order.
const routesIn = (css: string): readonly string[] => {
  const found = new Set<string>()
  for (const match of css.matchAll(/\[data-route="([^"]+)"\]/g)) {
    const value = match[1]
    if (value !== undefined) found.add(value)
  }
  return [...found].sort()
}

// The route segment each part resolves to, read off the selector the router itself builds.
const routableSegments = (): readonly string[] => {
  const found = new Set<string>()
  for (const part of Object.keys(TEMPLATES) as readonly PartName[]) {
    const match = /\[data-route="([^"]+)"\]/.exec(selectorFor(part, {}))
    const value = match?.[1]
    if (value !== undefined) found.add(value)
  }
  return [...found].sort()
}

describe("theme.css targets only what the router can address", () => {
  test("every data-route in the stylesheet is one a part resolves to", () => {
    const unaddressable = routesIn(CSS).filter((it) => !routableSegments().includes(it))
    expect(unaddressable).toEqual([])
  })

  test("the stylesheet uses no id selector and no !important, so a consumer rule can win", () => {
    // Declarations hold hex colours, so only selector text is searched for an id.
    const selectorsOnly = CSS.replace(/\{[^}]*\}/g, "{}")
    expect(selectorsOnly).not.toMatch(/#[a-zA-Z0-9]/)
    // Comments are prose about the rule, not the rule. Strip them before searching.
    expect(CSS.replace(/\/\*[\s\S]*?\*\//g, "")).not.toContain("!important")
  })

  test("layer order puts theme under structure, so a palette override needs no specificity", () => {
    expect(CSS).toMatch(/@layer\s+signal-grid\.theme\s*,\s*signal-grid\.structure\s*;/)
  })

  test("the rules actually sit inside those layers, which declaring them does not achieve", () => {
    // Declaring the order and then writing every rule unlayered was the state this test was
    // written to catch: the promise that a consumer rule wins held for nothing.
    expect(CSS).toContain("@layer signal-grid.theme {")
    expect(CSS).toContain("@layer signal-grid.structure {")

    // Walk the file tracking brace depth. A grid rule at depth 0 is outside every layer.
    let depth = 0
    const strays: string[] = []
    for (const line of CSS.split("\n")) {
      if (depth === 0 && /^\[data-route="g"\]/.test(line)) strays.push(line.trim())
      for (const char of line) {
        if (char === "{") depth++
        else if (char === "}") depth--
      }
    }
    expect(strays).toEqual([])
  })

  test("every custom property the stylesheet reads is one it also declares", () => {
    const declared = new Set<string>()
    for (const match of CSS.matchAll(/^\s*(--sg-[a-z-]+)\s*:/gm)) {
      const name = match[1]
      if (name !== undefined) declared.add(name)
    }
    for (const match of CSS.matchAll(/@property\s+(--sg-[a-z-]+)/g)) {
      const name = match[1]
      if (name !== undefined) declared.add(name)
    }
    const read = new Set<string>()
    for (const match of CSS.matchAll(/var\(\s*(--sg-[a-z-]+)/g)) {
      const name = match[1]
      if (name !== undefined) read.add(name)
    }
    // Written by the renderer rather than the stylesheet, so they are declared elsewhere by design.
    const fromJs = new Set([
      "--sg-h",
      "--sg-head-rows",
      "--sg-inline-tracks",
      "--sg-span-vertical",
      "--sg-span-horizontal",
    ])
    expect([...read].filter((name) => !declared.has(name) && !fromJs.has(name)).sort()).toEqual([])
  })
})
