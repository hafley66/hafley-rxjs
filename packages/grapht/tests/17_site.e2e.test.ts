// The docs site as the page under test. Three claims, all read out of the browser: the route
// template prints the page the browser actually lands on, the page is the one `site/content.ts`
// names, and a test-owned module mounts this repository's own markdown lane into that page's DOM.
import { fileURLToPath } from "node:url"
import { describe, expect, test, type TestLog } from "@hafley66/vitest-playwright"
import { inject } from "vitest"
import { matchPage, pageUrl } from "../site/routes.js"

// vitest 4 re-exports `ProvidedContext` from an internal chunk, so the plugin's `declare module`
// block declares a second, empty interface and `inject` types every key as `never`.
const base = (inject as (key: string) => string | undefined)("vitest-playwright:baseURL") ?? ""

// `base` is the readiness page, so the site root has to come from the route template, not from it.
const origin = new URL(base).origin
const siteRoot = pageUrl("")

/** `pageUrl` prints the path vitepress serves; the origin comes from the serve slot. */
const url = (page: string): string => new URL(pageUrl(page), origin).href

/** vitepress dev transforms workspace source on demand: `/@fs/` is how a page reaches a module. */
const moduleUrl = (relative: string): string =>
  `${origin}${siteRoot}@fs${fileURLToPath(new URL(relative, import.meta.url))}`

type ProbeGlobal = { __siteProbeUnmount?: () => void }

/** The hub's tab strip is served from the Pages root, so one site on its own cannot have it. */
const HUB_STRIP = "/strip.js"

/**
 * `log: { failOnConsoleError: false }` is set for this suite, because every page misses the hub
 * strip. This is that allowance, narrowed: a failing request other than the strip fails, and a
 * console error that is not a miss fails. JS exceptions stay the harness's own business.
 */
function expectOnlyStripMisses(log: TestLog): void {
  expect(
    log
      .$()
      .net.filter((n) => n.status !== undefined && n.status >= 400 && !n.url.endsWith(HUB_STRIP))
      .map((n) => `${n.status} ${n.url}`),
  ).toEqual([])
  expect(
    log
      .$()
      .console.filter((c) => c.type === "error" && !/404/.test(c.text))
      .map((c) => c.text),
  ).toEqual([])
}

/**
 * The markdown lane is the only thing on this site that reaches `unified` and `remark-parse`, so the
 * probe's first import is what teaches vitepress dev about them — the dependency optimizer runs
 * again, and every module URL 504s until it settles. The client's own answer to that window is a
 * reload; a test that is already mid-import gets to retry instead. Anything else, and a mount that
 * never happens, fails on the first attempt or on the last one.
 */
async function mountProbe(): Promise<boolean> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await $page.evaluate(async (spec: { probe: string }) => {
        // `new Function`, because vitest rewrites a dynamic `import()` written in this file into
        // its own SSR helper, and the page has no such helper.
        const load = new Function("u", "return import(u)") as (u: string) => Promise<unknown>
        const mod = (await load(spec.probe)) as {
          mountProbe: (host: HTMLElement) => () => void
        }
        const host = document.createElement("div")
        host.id = "site-probe-host"
        document.querySelector(".VPDoc")?.append(host)
        ;(globalThis as ProbeGlobal).__siteProbeUnmount = mod.mountProbe(host)
        return { stage: host.querySelector("[data-probe=markdown]") !== null }
      }, { probe: moduleUrl("site/probe.ts") }).then((mounted) => mounted.stage)
    } catch (error) {
      const transient = /Failed to fetch dynamically imported module|Execution context was destroyed/.test(
        String(error),
      )
      if (!transient || attempt >= 10) throw error
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }
}

describe("the docs site", () => {
  test("lands on the page the route template prints", async ({ log }) => {
    await $page.goto(url("model"))

    expect(matchPage(new URL($page.url()).pathname)).toEqual({ matched: true, values: { page: "model" } })
    expect(await $page.locator(".VPDoc h1").first().textContent()).toContain("The canonical model")

    // The sidebar is built from the same base the template carries, so a page's link is its `pageUrl`.
    const href = await $page
      .locator(".VPSidebar a", { hasText: "Renderers" })
      .first()
      .getAttribute("href")
    expect(href).toBe(pageUrl("renderers"))

    expectOnlyStripMisses(log)
  })

  test("renders the document site/content.ts names", async ({ log }) => {
    await $page.goto(url("model"))

    // The prose is the page's own: a claim only `pages/model.md` makes, read from the rendered body.
    const body = $page.locator(".VPDoc")
    await body.locator("h2", { hasText: "What a Graph is" }).first().waitFor()
    expect(await body.textContent()).toContain("There is no nesting by value")
    // The model page's generated header line, which cites the file the page documents.
    expect(await body.textContent()).toContain("packages/grapht-model/src/6_graph.ts")

    expectOnlyStripMisses(log)
  })

  test("mounts this repository's markdown lane into the page", async ({ log }) => {
    await $page.goto(url("model"))

    expect(await mountProbe()).toBe(true)

    // What the mounted module computed, read back through locators rather than inside the page: the
    // document parses to a graph the model's validator accepts, and the ids are the section and
    // block addresses the markdown lane derives.
    const probe = $page.locator("#site-probe-host")
    await probe.locator("[data-metric=nodes]").waitFor()
    expect(await probe.locator("[data-metric=nodes]").textContent()).toBe("9")
    expect(await probe.locator("[data-metric=edges]").textContent()).toBe("2")
    expect(await probe.locator("[data-metric=diagnostics]").textContent()).toBe("0")
    expect(
      await probe.locator("[data-ids=node]").first().evaluate((list) => [...list.children].map((it) => it.textContent)),
    ).toEqual([
      "board-notes",
      "usage",
      "details",
      "board-notes/0",
      "board-notes/1",
      "usage/0",
      "usage/1",
      "details/0",
      "details/1",
    ])

    const afterUnmount = await $page.evaluate(() => {
      ;(globalThis as ProbeGlobal).__siteProbeUnmount?.()
      return document.querySelectorAll("#site-probe-host [data-probe=markdown]").length
    })
    expect(afterUnmount).toBe(0)

    expectOnlyStripMisses(log)
  })
})
describe("the board page", () => {
  test("moves a card, keeps it through a re-anchor, and reloads it where it was left", async ({ log }) => {
    await $page.goto(url("board"))
    await $page.evaluate(() => localStorage.removeItem("grapht-board-demo"))
    await $page.reload({ waitUntil: "load" })

    const card = $page.locator(".board-card").nth(2)
    const moved = card.locator("code")
    const itemId = (await moved.textContent())?.trim() ?? ""
    const box = await card.boundingBox()
    if (!box) throw new Error("the board drew no card")

    await $page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await $page.mouse.down()
    await $page.mouse.move(box.x + box.width / 2 + 360, box.y + box.height / 2 + 80, { steps: 10 })
    await $page.mouse.up()

    // The board says how many items a person has placed, and it is not the whole board.
    expect(await $page.locator(".board-readout").textContent()).toContain("1 placed")
    const placedAt = await card.getAttribute("style")

    // An insertion above the fence re-anchors an item; the card a person moved does not care.
    await $page.locator("button", { hasText: "Insert a block above the fence" }).click()
    const note = await $page.locator(".board-note").textContent()
    expect(note).toContain("re-anchored, positions kept")
    expect(note).toMatch(/[0-9a-f]{6}→[0-9a-f]{6}/)
    expect(await $page.locator(".board-readout").textContent()).toContain("1 placed")
    expect(await $page.locator(`[data-item]`, { hasText: itemId }).first().getAttribute("style")).toBe(placedAt)

    // Reload: the position is where it was left, and it is still the only one a person placed.
    await $page.reload({ waitUntil: "load" })
    const reloaded = $page.locator(".board-card").nth(2)
    expect(await reloaded.textContent()).toContain(itemId)
    expect(await reloaded.getAttribute("style")).toBe(placedAt)
    expect(await $page.locator(".board-readout").textContent()).toContain("1 placed")

    expectOnlyStripMisses(log)
  })
})
