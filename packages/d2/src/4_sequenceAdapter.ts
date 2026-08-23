import { execFile } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"

import { documentFingerprint } from "../../grapht/src/12_sequenceIdentity"
import type { NativeSvgElement } from "../../grapht/src/13_sequenceSvgBinding"
import type { SequenceSourceAdapter } from "../../grapht/src/14_sequenceArtifact"
import { parseD2Sequence } from "./1_parse"
import { identifyD2Occurrences } from "./2_identity"
import { bindD2Svg } from "./3_bindSvg"

const execFileAsync = promisify(execFile)
const rendererOptions = ["--watch=false", "--theme=0", "--layout=dagre", "--pad=100", "--scale=1"]

async function inspectNativeSvg(svg: string, signal?: AbortSignal): Promise<NativeSvgElement[]> {
  signal?.throwIfAborted()
  const elements: NativeSvgElement[] = []
  const stack: Array<{ element: NativeSvgElement; childCount: number; text: string }> = []
  let offset = 0

  while (offset < svg.length) {
    const start = svg.indexOf("<", offset)
    const text = svg.slice(offset, start === -1 ? svg.length : start)
    const current = stack.at(-1)
    if (current) current.text += text
    if (start === -1) break

    if (svg.startsWith("<!--", start)) {
      offset = svg.indexOf("-->", start) + 3
      continue
    }
    if (svg.startsWith("<![CDATA[", start)) {
      offset = svg.indexOf("]]>", start) + 3
      continue
    }
    if (svg.startsWith("<?", start) || svg.startsWith("<!", start)) {
      offset = svg.indexOf(">", start) + 1
      continue
    }

    let end = start + 1
    let quote: string | undefined
    while (end < svg.length) {
      const character = svg[end]
      if (quote) {
        if (character === quote) quote = undefined
      } else if (character === '"' || character === "'") {
        quote = character
      } else if (character === ">") {
        break
      }
      end += 1
    }

    const tag = svg.slice(start, end + 1)
    if (tag.startsWith("</")) {
      const closed = stack.pop()
      if (closed && ["desc", "text", "title", "tspan"].includes(closed.element.tag)) {
        const normalized = closed.text.replace(/\s+/g, " ").trim()
        if (normalized) closed.element.text = normalized
      }
      offset = end + 1
      continue
    }

    const name = /^<\s*([A-Za-z][\w:.-]*)/.exec(tag)?.[1]
    if (!name) {
      offset = end + 1
      continue
    }

    const attributes = Object.fromEntries(
      [...tag.matchAll(/([:\w.-]+)\s*=\s*(["'])(.*?)\2/g)]
        .map(match => [match[1], match[3]])
        .sort(([left], [right]) => left.localeCompare(right)),
    )
    const parent = stack.at(-1)
    const element: NativeSvgElement = {
      path: parent ? [...parent.element.path, parent.childCount++] : [],
      tag: name.toLowerCase(),
      ...(attributes.id ? { id: attributes.id } : {}),
      classes: (attributes.class ?? "").split(/\s+/).filter(Boolean).sort(),
      attributes,
    }
    elements.push(element)

    if (!/\/\s*>$/.test(tag)) stack.push({ element, childCount: 0, text: "" })
    offset = end + 1
  }

  return elements
}

export const d2SequenceAdapter: SequenceSourceAdapter<ReturnType<typeof parseD2Sequence>> = {
  language: "d2",
  adapterVersion: "d2-sequence-adapter/0",
  parse: parseD2Sequence,
  identify: identifyD2Occurrences,
  async render(source, { signal } = {}) {
    signal?.throwIfAborted()
    const directory = await mkdtemp(join(tmpdir(), "hafley-d2-sequence-"))
    const inputPath = join(directory, "input.d2")
    const outputPath = join(directory, "output.svg")

    try {
      const versionOutput = await execFileAsync("d2", ["version"], { encoding: "utf8", signal })
      const rendererVersion = versionOutput.stdout.trim().replace(/^v/, "")
      if (rendererVersion !== "0.7.1") throw new Error(`d2 version mismatch: ${rendererVersion}`)
      await writeFile(inputPath, source)
      await execFileAsync("d2", [...rendererOptions, inputPath, outputPath], { encoding: "utf8", signal })
      const svg = await readFile(outputPath, "utf8")
      signal?.throwIfAborted()
      return {
        language: "d2",
        rendererPackage: "d2",
        rendererVersion,
        sourceHash: documentFingerprint(source),
        svgHash: documentFingerprint(svg),
        options: rendererOptions,
        svg,
        elements: await inspectNativeSvg(svg, signal),
      }
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  },
  bind: bindD2Svg,
}
