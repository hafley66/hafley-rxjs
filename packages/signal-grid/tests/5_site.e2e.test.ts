// The docs site as the page under test. Two claims, both read out of the browser: the route template
// prints the page the browser actually lands on, and a test-owned module mounts this repository's
// own source into that page's DOM.
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
    log.$()
      .net.filter((n) => n.status !== undefined && n.status >= 400 && !n.url.endsWith(HUB_STRIP))
      .map((n) => `${n.status} ${n.url}`),
  ).toEqual([])
  expect(
    log.$()
      .console.filter((c) => c.type === "error" && !/404/.test(c.text))
      .map((c) => c.text),
  ).toEqual([])
}

describe("the docs site", () => {
  test("lands on the page the route template prints", async ({ log }) => {
    await $page.goto(url("rows-sort"))

    expect(matchPage(new URL($page.url()).pathname)).toEqual({ matched: true, values: { page: "rows-sort" } })
    expect(await $page.locator(".VPDoc h1").first().textContent()).toContain("Sort")

    // The sidebar is built from the same base the template carries, so a link's href is the URL.
    const href = await $page.locator(".VPSidebar a", { hasText: "Tree data" }).first().getAttribute("href")
    expect(href).toBe(pageUrl("rows-tree"))

    expectOnlyStripMisses(log)
  })

  test("runs the grid the page embeds", async ({ log }) => {
    await $page.goto(url("rows-sort"))
    const demo = $page.locator(".demo").first()
    await demo.locator(".sg-row").first().waitFor()

    // Rows and header labels come from the page's own demo, not from a fixture the suite built.
    expect(await demo.locator(".sg-row").count()).toBeGreaterThan(0)
    expect((await demo.locator(".sg-head-label").allTextContents()).map((it) => it.trim())).toContain("Kind")
    expect(await demo.locator(".demo-strip").textContent()).toContain("fps")

    expectOnlyStripMisses(log)
  })

  test("mounts this repository's source into the page", async ({ log }) => {
    await $page.goto(url("rows-sort"))

    const mounted = await $page.evaluate(
      async (spec: { probe: string }) => {
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
        return { stage: host.querySelector("[data-probe=grid]") !== null }
      },
      { probe: moduleUrl("site/probe.ts") },
    )

    expect(mounted.stage).toBe(true)

    // The grid paints into the docs DOM after mount, so the count is read through a locator rather
    // than synchronously inside the page.
    const probe = $page.locator("#site-probe-host")
    await probe.locator(".sg-row").first().waitFor()
    expect(await probe.locator(".sg-row").count()).toBe(3)

    const afterUnmount = await $page.evaluate(() => {
      ;(globalThis as ProbeGlobal).__siteProbeUnmount?.()
      return document.querySelectorAll("#site-probe-host .sg-row").length
    })
    expect(afterUnmount).toBe(0)

    expectOnlyStripMisses(log)
  })
})