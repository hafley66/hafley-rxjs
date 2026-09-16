import { readFileSync } from "node:fs"

/**
 * The Playwright selector engine is a build artifact, not a file that ships inside `playwright-core`
 * (its injected sources are bundled into `coreBundle.js`). Callers therefore supply the engine source
 * explicitly, either as a path or through the environment.
 */
export function loadEngineSource({ from = process.env.BEWPP_ENGINE_SOURCE }: { from?: string } = {}): string {
  if (!from) {
    throw new Error(
      "Set BEWPP_ENGINE_SOURCE or pass { from } with the path to a built Playwright injected script " +
        "(playwright/packages/injected/lib/injectedScript.js, produced by `node utils/generate_injected.js`).",
    )
  }
  const source = readFileSync(from, "utf8")
  if (!source.includes("InjectedScript")) throw new Error(`${from} does not look like a Playwright injected script.`)
  return source
}
