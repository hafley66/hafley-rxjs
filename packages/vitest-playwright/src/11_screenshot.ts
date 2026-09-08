// pkg:toHaveScreenshot over pw:Page._expectScreenshot: the server stabilizes (two consecutive frames agree) and
// compares with its bundled pixelmatch/ssim, so no image library lands here. Baselines sit next to the test file at
// {dir}/{testFile}/{name}-{browser}-{platform}.png; vitest -u (snapshotState "all") rewrites them like text snapshots.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { basename, dirname, join } from "node:path"
import { recordArtifact, type Test } from "@vitest/runner"
import type { Locator, Page } from "playwright"
import { inject, type MatcherState } from "vitest"
import { KEY, type ResolvedOptions } from "./0_options.js"
import { als } from "./6_roots.js"
import { attemptDir, slug } from "./8_around.js"

export type ScreenshotOptions = {
  animations?: "disabled" | "allow"
  caret?: "hide" | "initial"
  clip?: { x: number; y: number; width: number; height: number }
  fullPage?: boolean
  mask?: Locator[]
  maskColor?: string
  omitBackground?: boolean
  scale?: "css" | "device"
  style?: string
  stylePath?: string | string[]
  timeout?: number
  maxDiffPixels?: number
  maxDiffPixelRatio?: number
  threshold?: number
}
/** A baseline name: "hero.png", "hero", or ["dir", "hero.png"] for a subfolder under the test file's folder. */
export type ScreenshotName = string | string[]

/** pw: the wire payload of Page._expectScreenshot. */
type ExpectScreenshotPayload = Omit<ScreenshotOptions, "stylePath"> & {
  locator?: Locator
  expected?: Buffer
  isNot: boolean
  timeout: number
  signal?: AbortSignal
  type: "png"
  comparator?: string
}
type ExpectScreenshotResult = {
  actual?: Buffer
  previous?: Buffer
  diff?: Buffer
  errorMessage?: string
  log?: string[]
  timedOut?: boolean
}
type ScreenshotHost = { _expectScreenshot(o: ExpectScreenshotPayload): Promise<ExpectScreenshotResult> }
type UpdateMode = "all" | "new" | "none"
type Ctx = MatcherState & { task?: Readonly<Test> }
type Result = { pass: boolean; message: () => string }

const isNamed = (x: unknown): x is ScreenshotName => typeof x === "string" || Array.isArray(x)

function options(): { o: ResolvedOptions; signal?: AbortSignal; shot: number } {
  const s = als.getStore()
  if (s) {
    const o = s.root.options.$()
    const shot = s.root.shots.$() + 1
    s.root.shots.$(shot)
    return { o, signal: s.root.signal.$(), shot }
  }
  return { o: inject(KEY.options), shot: 0 }
}

/** Baseline path for a name; exported so a test (or a seeding script) can compute where a baseline lives. */
export function baselinePath(testPath: string, o: ResolvedOptions, name: ScreenshotName): string {
  const parts = (Array.isArray(name) ? name : [name]).slice()
  const last = parts.pop() ?? "screenshot.png"
  const stem = last.endsWith(".png") ? last.slice(0, -4) : last
  return join(
    dirname(testPath),
    o.screenshots.dir,
    basename(testPath),
    ...parts,
    `${stem}-${o.browser.name}-${process.platform}.png`,
  )
}

/** vitest: the update mode lives on the private field of the file's SnapshotState (`-u` sets "all", CI "none"). */
function updateMode(state: MatcherState): UpdateMode {
  const s = state.snapshotState as unknown as { _updateSnapshot?: UpdateMode } | undefined
  return s?._updateSnapshot ?? "new"
}

function pngSize(buf: Buffer): { width: number; height: number } {
  return buf.length >= 24 ? { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) } : { width: 0, height: 0 }
}
function write(path: string, body: Buffer): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, body)
}
function loadStyles(stylePath: string | string[] | undefined, style: string | undefined): string | undefined {
  if (!stylePath) return style
  const paths = Array.isArray(stylePath) ? stylePath : [stylePath]
  const text = paths.map(p => readFileSync(p, "utf8").trim()).join("\n")
  return style ? `${style}\n${text}` : text
}

/** The matcher body; 3_matchers wraps it with the receiver guard and the expect.poll takeover flag. */
export async function screenshot(
  this: Ctx,
  receiver: Page | Locator,
  nameOrOptions: ScreenshotName | ScreenshotOptions = {},
  extra: ScreenshotOptions = {},
): Promise<Result> {
  const { o, signal, shot } = options()
  const opt: ScreenshotOptions = isNamed(nameOrOptions) ? extra : nameOrOptions
  const testPath = this.testPath
  if (!testPath || !this.task) throw new Error("toHaveScreenshot: must be called inside a test")
  const name: ScreenshotName = isNamed(nameOrOptions)
    ? nameOrOptions
    : `${slug(this.currentTestName ?? "test")}-${shot}`
  const expectedPath = baselinePath(testPath, o, name)
  const label = Array.isArray(name) ? name.join("/") : name
  const not = this.isNot ? ".not" : ""
  const hint = (tail: string) =>
    `expect(${isPage(receiver) ? "page" : "locator"})${not}.toHaveScreenshot(${JSON.stringify(label)}) ${tail}`
  const isLocatorReceiver = !isPage(receiver)
  const page: Page = isLocatorReceiver ? (receiver as Locator).page() : (receiver as Page)
  const payload: ExpectScreenshotPayload = {
    locator: isLocatorReceiver ? (receiver as Locator) : undefined,
    animations: opt.animations ?? o.screenshots.animations,
    caret: opt.caret ?? o.screenshots.caret,
    clip: opt.clip,
    fullPage: opt.fullPage,
    mask: opt.mask,
    maskColor: opt.maskColor,
    omitBackground: opt.omitBackground,
    scale: opt.scale ?? o.screenshots.scale,
    style: loadStyles(opt.stylePath, opt.style),
    isNot: this.isNot,
    timeout: opt.timeout ?? o.expectTimeout,
    signal,
    type: "png",
    maxDiffPixels: opt.maxDiffPixels ?? o.screenshots.maxDiffPixels,
    maxDiffPixelRatio: opt.maxDiffPixelRatio ?? o.screenshots.maxDiffPixelRatio,
    threshold: opt.threshold ?? o.screenshots.threshold,
  }
  const mode = updateMode(this)
  const hasBaseline = existsSync(expectedPath)
  const host = page as unknown as ScreenshotHost

  if (this.isNot) {
    // pass=true under .not is a failure: vitest inverts
    if (!hasBaseline)
      return { pass: true, message: () => hint(`failed: no baseline at ${expectedPath}; .not never writes one`) }
    const r = await host._expectScreenshot({ ...payload, expected: readFileSync(expectedPath) })
    return { pass: !!r.errorMessage, message: () => hint(`failed: the screenshot still matches ${expectedPath}`) }
  }
  if (!hasBaseline && mode === "none")
    return { pass: false, message: () => hint(`failed: no baseline at ${expectedPath} (update mode "none")`) }

  const expected = hasBaseline && mode !== "all" ? readFileSync(expectedPath) : undefined
  const r = await host._expectScreenshot({ ...payload, expected })
  if (!r.errorMessage && expected) return { pass: true, message: () => hint("passed") }
  if (!r.errorMessage && r.actual) {
    write(expectedPath, r.actual)
    return { pass: true, message: () => hint(`wrote ${expectedPath}`) }
  }
  // mismatch, or the page never settled: keep actual/expected/diff beside the attempt's other artifacts
  const dir = attemptDir(o, this.task)
  const stem = slug(label)
  const files: { name: "reference" | "actual" | "diff"; path: string; body: Buffer }[] = []
  if (expected) files.push({ name: "reference", path: join(dir, `${stem}-expected.png`), body: expected })
  if (r.actual) files.push({ name: "actual", path: join(dir, `${stem}-actual.png`), body: r.actual })
  if (r.diff) files.push({ name: "diff", path: join(dir, `${stem}-diff.png`), body: r.diff })
  for (const f of files) write(f.path, f.body)
  if (files.length)
    await recordArtifact(this.task, {
      type: "internal:toMatchScreenshot",
      kind: "visual-regression",
      message: r.errorMessage ?? "screenshot did not settle",
      attachments: files.map(f => ({ name: f.name, path: f.path, contentType: "image/png", ...pngSize(f.body) })),
    })
  const lines = [
    hint(`failed${r.timedOut ? ` (timeout ${payload.timeout}ms)` : ""}`),
    "",
    r.errorMessage ?? "no screenshot",
    "",
    ...files.map(f => `${f.name.padEnd(9)} ${f.path}`),
    ...(r.log?.length ? ["", "Call log:", ...r.log.map(l => `  - ${l}`)] : []),
  ]
  return { pass: false, message: () => lines.join("\n") }
}

const isPage = (x: unknown): x is Page => {
  const o = x as { mainFrame?: unknown; context?: unknown } | null
  return !!o && typeof o.mainFrame === "function" && typeof o.context === "function"
}
