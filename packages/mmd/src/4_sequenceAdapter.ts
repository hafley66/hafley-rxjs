import { fileURLToPath } from "node:url"
import { documentFingerprint, type NativeSvgElement, type SequenceSourceAdapter } from "@hafley66/grapht-model"
import { chromium, type Page } from "playwright"
import { parseMermaidSequence } from "./1_parse"
import { identifyMermaidOccurrences } from "./2_identity"
import { bindMermaidSvg } from "./3_bindSvg"

const rendererOptions = {
  deterministicIDSeed: "hafley-sequence-renderer-smoke",
  deterministicIds: true,
  fontFamily: "Arial",
  securityLevel: "strict",
  startOnLoad: false,
  theme: "base",
  sequence: { useMaxWidth: false },
}

async function inspectNativeSvg(page: Page, svg: string, signal?: AbortSignal): Promise<NativeSvgElement[]> {
  signal?.throwIfAborted()
  return page.evaluate(svgText => {
    const parsed = new DOMParser().parseFromString(svgText, "image/svg+xml")
    const root = parsed.documentElement
    if (root.tagName.toLowerCase() !== "svg" || parsed.querySelector("parsererror")) {
      throw new Error("native renderer output has no outer SVG element")
    }

    return [root, ...root.querySelectorAll("*")].map(element => {
      const path: number[] = []
      let cursor: Element = element

      while (cursor !== root) {
        const parent = cursor.parentElement
        if (!parent) throw new Error("native SVG element detached during receipt walk")
        path.unshift([...parent.children].indexOf(cursor))
        cursor = parent
      }

      const attributes = Object.fromEntries(
        [...element.attributes]
          .sort((left, right) => left.name.localeCompare(right.name))
          .map(attribute => [attribute.name, attribute.value]),
      )
      const textTags = new Set(["desc", "text", "title", "tspan"])
      const text = textTags.has(element.tagName.toLowerCase())
        ? [...element.childNodes]
            .filter(node => node.nodeType === Node.TEXT_NODE)
            .map(node => node.textContent)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim()
        : ""

      return {
        path,
        tag: element.tagName.toLowerCase(),
        ...(element.id ? { id: element.id } : {}),
        classes: [...element.classList].sort(),
        ...(text ? { text } : {}),
        attributes,
      }
    })
  }, svg)
}

export const mermaidSequenceAdapter: SequenceSourceAdapter<ReturnType<typeof parseMermaidSequence>> = {
  language: "mermaid",
  adapterVersion: "mermaid-sequence-adapter/0",
  parse: parseMermaidSequence,
  identify: identifyMermaidOccurrences,
  async render(source, { signal } = {}) {
    signal?.throwIfAborted()
    const browser = await chromium.launch({ headless: true })
    let svg = ""
    let elements: NativeSvgElement[] = []

    try {
      const page = await browser.newPage({ viewport: { width: 800, height: 600 } })
      const bundlePath = fileURLToPath(import.meta.resolve("mermaid/dist/mermaid.min.js"))
      await page.setContent('<div id="sequence-renderer-root"></div>')
      await page.addScriptTag({ path: bundlePath })
      svg = await page.evaluate(
        async ({ diagramSource, options }) => {
          const mermaid = globalThis as typeof globalThis & {
            mermaid: {
              initialize(options: unknown): void
              render(id: string, source: string): Promise<{ svg: string }>
            }
          }
          mermaid.mermaid.initialize(options)
          return (await mermaid.mermaid.render("sequence-renderer-smoke", diagramSource)).svg
        },
        { diagramSource: source, options: rendererOptions },
      )
      elements = await inspectNativeSvg(page, svg, signal)
    } finally {
      await browser.close()
    }

    signal?.throwIfAborted()
    return {
      language: "mermaid",
      rendererPackage: "mermaid",
      rendererVersion: "11.16.0",
      sourceHash: documentFingerprint(source),
      svgHash: documentFingerprint(svg),
      options: rendererOptions,
      svg,
      elements,
    }
  },
  bind: bindMermaidSvg,
}
