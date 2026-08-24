import { execFile } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { promisify } from "node:util"

import { chromium } from "playwright"

const execFileAsync = promisify(execFile)

export const sequenceRendererPins = Object.freeze({
  mermaid: Object.freeze({
    package: "mermaid",
    version: "11.16.0",
    hostPackage: "playwright",
    hostVersion: "1.62.1",
    options: Object.freeze({
      deterministicIDSeed: "hafley-sequence-renderer-smoke",
      deterministicIds: true,
      fontFamily: "Arial",
      securityLevel: "strict",
      startOnLoad: false,
      theme: "base",
      sequence: Object.freeze({ useMaxWidth: false }),
    }),
  }),
  d2: Object.freeze({
    command: "d2",
    version: "0.7.1",
    options: Object.freeze([
      "--watch=false",
      "--theme=0",
      "--layout=dagre",
      "--pad=100",
      "--scale=1",
    ]),
  }),
})

export const mermaidSequenceSmokeSource = `sequenceDiagram
  participant Alice
  participant Bob
  Alice->>Bob: hello
`

export const d2SequenceSmokeSource = `shape: sequence_diagram
alice: Alice
bob: Bob
alice -> bob: hello
`

export class SequenceRendererUnavailableError extends Error {
  constructor(renderer, expected, cause) {
    super(
      `sequence renderer unavailable: ${renderer}; expected ${expected}; ${cause.message}`,
      { cause },
    )
    this.name = "SequenceRendererUnavailableError"
    this.renderer = renderer
    this.expected = expected
  }
}

export class SequenceRendererVersionError extends Error {
  constructor(renderer, expected, actual) {
    super(
      `sequence renderer version mismatch: ${renderer}; expected ${expected}; received ${actual}`,
    )
    this.name = "SequenceRendererVersionError"
    this.renderer = renderer
    this.expected = expected
    this.actual = actual
  }
}

async function findPackageVersion(packageName, moduleSpecifier = packageName) {
  const moduleUrl = import.meta.resolve(moduleSpecifier)
  let directory = dirname(fileURLToPath(moduleUrl))

  while (directory !== dirname(directory)) {
    const packagePath = join(directory, "package.json")

    try {
      const packageJson = JSON.parse(await readFile(packagePath, "utf8"))

      if (packageJson.name === packageName) {
        return packageJson.version
      }
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error
      }
    }

    directory = dirname(directory)
  }

  throw new SequenceRendererUnavailableError(
    packageName,
    "a repository-installed package",
    new Error(`could not locate package.json from ${moduleUrl}`),
  )
}

function assertVersion(renderer, expected, actual) {
  if (actual !== expected) {
    throw new SequenceRendererVersionError(renderer, expected, actual)
  }
}

function inspectSvg(svg) {
  const viewBox = svg.match(/\bviewBox="([^"]+)"/)?.[1]

  return {
    rootTag: svg.match(/<svg\b/)?.[0] ?? null,
    viewBox: viewBox ?? null,
    containsAlice: svg.includes("Alice"),
    containsBob: svg.includes("Bob"),
    containsHello: svg.includes("hello"),
    hasClosingTag: svg.includes("</svg>"),
  }
}

export async function renderMermaidSequenceSmoke(
  source = mermaidSequenceSmokeSource,
) {
  const pin = sequenceRendererPins.mermaid
  const mermaidVersion = await findPackageVersion(
    pin.package,
    "mermaid/dist/mermaid.min.js",
  )
  const playwrightVersion = await findPackageVersion(pin.hostPackage)

  assertVersion(pin.package, pin.version, mermaidVersion)
  assertVersion(pin.hostPackage, pin.hostVersion, playwrightVersion)

  let browser

  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } })
    const bundlePath = fileURLToPath(
      import.meta.resolve("mermaid/dist/mermaid.min.js"),
    )

    await page.setContent('<div id="sequence-renderer-root"></div>')
    await page.addScriptTag({ path: bundlePath })

    const svg = await page.evaluate(
      async ({ diagramSource, options }) => {
        globalThis.mermaid.initialize(options)
        const rendered = await globalThis.mermaid.render(
          "sequence-renderer-smoke",
          diagramSource,
        )
        return rendered.svg
      },
      { diagramSource: source, options: pin.options },
    )

    return {
      renderer: pin.package,
      version: mermaidVersion,
      host: pin.hostPackage,
      hostVersion: playwrightVersion,
      browserVersion: browser.version(),
      options: pin.options,
      svg,
    }
  } catch (error) {
    if (
      error instanceof SequenceRendererUnavailableError ||
      error instanceof SequenceRendererVersionError
    ) {
      throw error
    }

    throw new SequenceRendererUnavailableError(
      pin.package,
      `${pin.package}@${pin.version} in ${pin.hostPackage}@${pin.hostVersion}`,
      error,
    )
  } finally {
    await browser?.close()
  }
}

export async function renderD2SequenceSmoke(source = d2SequenceSmokeSource) {
  const pin = sequenceRendererPins.d2
  const directory = await mkdtemp(join(tmpdir(), "hafley-sequence-renderer-"))
  const inputPath = join(directory, "smoke.d2")
  const outputPath = join(directory, "smoke.svg")

  try {
    let versionOutput

    try {
      versionOutput = await execFileAsync(pin.command, ["version"], {
        encoding: "utf8",
      })
    } catch (error) {
      throw new SequenceRendererUnavailableError(
        pin.command,
        `${pin.command} ${pin.version} on PATH`,
        error,
      )
    }

    const version = versionOutput.stdout.trim().replace(/^v/, "")
    assertVersion(pin.command, pin.version, version)

    await writeFile(inputPath, source)
    await execFileAsync(pin.command, [...pin.options, inputPath, outputPath], {
      encoding: "utf8",
    })
    const svg = await readFile(outputPath, "utf8")

    return {
      renderer: pin.command,
      version,
      options: pin.options,
      svg,
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

export async function smokeSequenceRenderers() {
  const [mermaid, d2] = await Promise.all([
    renderMermaidSequenceSmoke(),
    renderD2SequenceSmoke(),
  ])

  return {
    mermaid: {
      renderer: mermaid.renderer,
      version: mermaid.version,
      host: mermaid.host,
      hostVersion: mermaid.hostVersion,
      browserVersion: mermaid.browserVersion,
      options: mermaid.options,
      svg: inspectSvg(mermaid.svg),
    },
    d2: {
      renderer: d2.renderer,
      version: d2.version,
      options: d2.options,
      svg: inspectSvg(d2.svg),
    },
  }
}

const invokedPath = process.argv[1]

if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  const receipt = await smokeSequenceRenderers()
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`)
}
