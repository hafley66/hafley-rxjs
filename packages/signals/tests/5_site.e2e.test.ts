// The docs site as the page under test. Three claims, all read out of the browser: the route
// template prints the page the browser actually lands on, the page's own demo runs on it, and a
// test-owned module mounts this repository's own source into that page's DOM.
import { fileURLToPath } from "node:url"
import { describe, expect, test, type TestLog } from "@hafley66/vitest-playwright"
import { inject } from "vitest"
import { matchPage, pageUrl } from "../site/routes.js"
import type { ProbeHandle } from "./site/probe.js"

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

/** The page the suite reads: a slug `site/content.ts` registers, with the demo `form-computed.md` embeds. */
const PAGE = "form-computed"

/** The title `examples/4_computed.ts` registers under `computed-thunk`, rendered by the site's demo panel. */
const DEMO_TITLE = "Derivation is a thunk"

type ProbeGlobal = { __siteProbe?: ProbeHandle }

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
    await $page.goto(url(PAGE))

    expect(matchPage(new URL($page.url()).pathname)).toEqual({
      matched: true,
      values: { page: PAGE },
    })
    expect(await $page.locator(".VPDoc h1").first().textContent()).toContain("Computed")

    // The sidebar is built from the same base the template carries, so a link's href is the URL.
    const href = await $page
      .locator(".VPSidebar a", { hasText: "Computed" })
      .first()
      .getAttribute("href")
    expect(href).toBe(pageUrl(PAGE))

    expectOnlyStripMisses(log)
  })

  test("runs the demo the page embeds", async ({ log }) => {
    await $page.goto(url(PAGE))
    const demo = $page.locator(".demo").first()
    await demo.locator(".demo-stage").waitFor()
    // The demo subscribes when its stage reaches the viewport, so the readouts only fill in once
    // the panel is actually on screen.
    await demo.scrollIntoViewIfNeeded()

    // Title and controls come from the page's own demo, not from a fixture the suite built.
    expect(await demo.locator(".demo-title").textContent()).toBe(DEMO_TITLE)
    expect(await demo.locator(".sx-button").count()).toBe(3)

    // `left` starts at 1 and the body reads `left`, so the derived value is the page's own number.
    await expect(demo.locator('.sx-readout[data-read="the derived value"] .sx-value')).toHaveText(
      "left is 1",
    )
    expect(await demo.locator(".demo-strip").textContent()).toContain("fps")

    expectOnlyStripMisses(log)
  })

  test("mounts this repository's source into the page", async ({ log }) => {
    await $page.goto(url(PAGE))

    const mounted = await $page.evaluate(
      async (spec: { probe: string }) => {
        // `new Function`, because vitest rewrites a dynamic `import()` written in this file into
        // its own SSR helper, and the page has no such helper.
        const load = new Function("u", "return import(u)") as (u: string) => Promise<unknown>
        const mod = (await load(spec.probe)) as {
          mountProbe: (host: HTMLElement) => ProbeHandle
        }
        const host = document.createElement("div")
        host.id = "site-probe-host"
        document.querySelector(".VPDoc")?.append(host)
        ;(globalThis as ProbeGlobal).__siteProbe = mod.mountProbe(host)
        return { stage: host.querySelector("[data-probe=signal]") !== null }
      },
      { probe: moduleUrl("site/probe.ts") },
    )

    expect(mounted.stage).toBe(true)

    const probe = $page.locator("#site-probe-host")
    // The probe painted from a read of the signal, so the number on screen is the signal's value.
    await expect(probe.locator(".probe-value")).toHaveText("0")

    // The real reactivity claim: a write made in the page reaches the DOM the probe rendered.
    await $page.evaluate(() => {
      ;(globalThis as ProbeGlobal).__siteProbe?.write(42)
    })
    await expect(probe.locator(".probe-value")).toHaveText("42")

    const afterUnmount = await $page.evaluate(() => {
      ;(globalThis as ProbeGlobal).__siteProbe?.unsubscribe()
      return document.querySelectorAll("#site-probe-host [data-probe=signal]").length
    })
    expect(afterUnmount).toBe(0)

    expectOnlyStripMisses(log)
  })
})
