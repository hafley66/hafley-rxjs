import { defineConfig } from "vitest/config"

/**
 * The files whose subject is a document: an element that receives a write, a route that resolves
 * against a live query engine, a style property a real engine has to parse. Every one of them ran
 * against a simulated document until `vitest.browser.config.ts` picked them up, and a simulated
 * document is what this package no longer keeps: it returns a zero for every measurement and
 * stores a style property back without agreeing to it.
 *
 * Named one path at a time rather than globbed onto a `*.browser.test.ts` suffix, because `README.md`
 * and six pages under `docs/` cite these paths and `scripts/docs.mjs` fails a citation whose file is
 * gone. The filenames stay where the docs point, and the runner is chosen by this list.
 *
 * `vitest.browser.config.ts` imports the same array as its include, so a file can never sit in both
 * runners or in neither.
 */
export const DOM_TESTS: readonly string[] = [
  "src/8_grid.test.ts",
  "src/9_css.test.ts",
  "src/10_render.test.ts",
  "src/13_composite.test.ts",
  "src/14_measure.test.ts",
  "src/16_menu.test.ts",
  "src/17_in_view.test.ts",
  "src/18_bands.dom.test.ts",
  "src/examples.dom.test.ts",
  // The one entry outside `src/`: it mounts a demo route, and `src/**/*.test.ts` below never
  // collects it, so naming it here puts it in the browser runner and in no other.
  "demo/5_sheet.test.ts",
]

// `tests/` holds browser e2e that needs the serve slot and a real chromium, which only
// vitest.e2e.config.ts provides. Without this exclude, a bare `vitest run` collects those files
// with no baseURL and they skip themselves, which reads as a broken suite rather than a scoped one.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["tests/**", "fixtures/**", "node_modules/**", "dist/**", ...DOM_TESTS],
  },
})
