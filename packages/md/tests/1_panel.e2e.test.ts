import { expect, test } from "@hafley66/vitest-playwright"
import { FIXTURE_DOC } from "../fixtures/docs.js"

// domcontentloaded, not load: the module graph carries mermaid and the d2 bundle,
// and the locator assertions below wait for what they need.
const open = async (page: { goto: (url: string, options?: object) => Promise<unknown> }, baseURL: string | undefined) => {
  await page.goto(baseURL ?? "/", { waitUntil: "domcontentloaded" })
}

test("renders sections and folds one on click", async ({ page, baseURL }) => {
  await open(page, baseURL)
  await expect(page.locator(".mdview-sec")).toHaveCount(3)
  await expect(page.locator(".mdview-body")).toHaveCount(3)
  expect(await page.locator(".mdview-head").evaluateAll((heads) => heads.map((head) => head.id))).toEqual([
    "overview",
    "diagrams",
    "plain",
  ])
  await expect(page.locator(".md-body p").first()).toHaveText(/Intro paragraph/)

  // The head is the fold control and the section anchor at once.
  await page.locator("[data-mdsec='overview']").click()
  await expect(page.locator(".mdview-body")).toHaveCount(2)
  await expect(page.locator(".md-body p")).toHaveCount(0)
  await expect(page.locator("[data-mdsec='overview']")).toBeVisible()
})

test("mounts grapht for sequence fences and renders other fences as inline SVG", async ({ page, baseURL }) => {
  await open(page, baseURL)
  await expect(page.locator("[data-grapht-host]")).toHaveCount(2)
  await expect(page.locator("[data-grapht-host='mermaid']")).toHaveAttribute("data-grapht-items", /^([2-9]|\d\d+)$/)
  await expect(page.locator("[data-grapht-host='d2']")).toHaveAttribute("data-grapht-items", /^([2-9]|\d\d+)$/)
  // Cytoscape paints through canvas layers; one attached is enough here.
  await expect(page.locator("[data-grapht-host='mermaid'] canvas").first()).toBeAttached()
  // Fences the language adapters do not bind stay on the plain SVG path.
  await expect(page.locator(".mdview-mermaid [data-grapht-host]")).toHaveCount(0)
  await expect(page.locator(".mdview-d2 [data-grapht-host]")).toHaveCount(0)
  await expect(page.locator(".mdview-mermaid svg").first()).toBeAttached()
  await expect(page.locator(".mdview-d2 svg").first()).toBeAttached()
  await expect(page.locator(".mdview-sequence-error")).toHaveCount(0)
  expect(await page.locator(".mdview-mermaid svg").first().evaluate((svg) => svg.textContent?.includes("Start") ?? false)).toBe(
    true,
  )
})

test("names the file bytes each sequence fence came from", async ({ page, baseURL }) => {
  await open(page, baseURL)
  await expect(page.locator("[data-grapht-host='mermaid']")).toHaveAttribute(
    "data-grapht-source",
    String(FIXTURE_DOC.indexOf("sequenceDiagram")),
  )
  await expect(page.locator("[data-grapht-host='d2']")).toHaveAttribute(
    "data-grapht-source",
    String(FIXTURE_DOC.indexOf("shape: sequence_diagram")),
  )
})

test("opens a rendered diagram in the lightbox", async ({ page, baseURL }) => {
  await open(page, baseURL)
  await page.locator(".mdview-sequence-open").first().click()
  const lightbox = page.locator(".diagram-lightbox")
  await expect(lightbox).toBeVisible()
  await expect(lightbox.locator("svg")).toHaveCount(1)
  expect(await lightbox.locator("svg").evaluate((svg) => svg.getAttribute("viewBox"))).not.toBeNull()
})
