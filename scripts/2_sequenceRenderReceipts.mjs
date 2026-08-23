import { createHash } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"

import { chromium } from "playwright"

import {
  renderD2SequenceSmoke,
  renderMermaidSequenceSmoke,
} from "./0_sequenceRendererSmoke.mjs"

const fixtureDirectory = new URL("../fixtures/sequence/", import.meta.url)

export const sequenceReceiptFiles = Object.freeze({
  mermaid: Object.freeze({
    source: "0_mermaid.mmd",
    svg: "6_mermaid.svg",
    receipt: "7_mermaid.receipt.json",
    revisionSource: "4_mermaid.revision.mmd",
    revisionSvg: "8_mermaid.revision.svg",
    revisionReceipt: "9_mermaid.revision.receipt.json",
  }),
  d2: Object.freeze({
    source: "2_d2.d2",
    svg: "10_d2.svg",
    receipt: "11_d2.receipt.json",
    revisionSource: "5_d2.revision.d2",
    revisionSvg: "12_d2.revision.svg",
    revisionReceipt: "13_d2.revision.receipt.json",
  }),
})

function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

export async function inspectNativeSvg(svg) {
  const browser = await chromium.launch({ headless: true })

  try {
    const page = await browser.newPage()
    await page.setContent(svg)

    return await page.evaluate(() => {
      const root = [...document.body.children].find(
        (element) => element.tagName.toLowerCase() === "svg",
      )

      if (!root) {
        throw new Error("native renderer output has no outer SVG element")
      }

      return [root, ...root.querySelectorAll("*")].map((element) => {
        const path = []
        let cursor = element

        while (cursor !== root) {
          const parent = cursor.parentElement

          if (!parent) {
            throw new Error("native SVG element detached during receipt walk")
          }

          path.unshift([...parent.children].indexOf(cursor))
          cursor = parent
        }

        const attributes = Object.fromEntries(
          [...element.attributes]
            .sort((left, right) => left.name.localeCompare(right.name))
            .map((attribute) => [attribute.name, attribute.value]),
        )
        const textTags = new Set(["desc", "text", "title", "tspan"])
        const directText = textTags.has(element.tagName.toLowerCase())
          ? [...element.childNodes]
              .filter((node) => node.nodeType === Node.TEXT_NODE)
              .map((node) => node.textContent)
              .join(" ")
              .replace(/\s+/g, " ")
              .trim()
          : ""
        const receiptElement = {
          path,
          tag: element.tagName.toLowerCase(),
          classes: [...element.classList].sort(),
          attributes,
        }

        if (element.id) {
          receiptElement.id = element.id
        }

        if (directText) {
          receiptElement.text = directText
        }

        return receiptElement
      })
    })
  } finally {
    await browser.close()
  }
}

export async function renderSequenceReceipt(language, source) {
  const render =
    language === "mermaid"
      ? renderMermaidSequenceSmoke
      : renderD2SequenceSmoke
  const rendered = await render(source)
  const elements = await inspectNativeSvg(rendered.svg)

  return {
    language,
    rendererPackage: rendered.renderer,
    rendererVersion: rendered.version,
    ...(rendered.host
      ? {
          hostPackage: rendered.host,
          hostVersion: rendered.hostVersion,
          browserVersion: rendered.browserVersion,
        }
      : {}),
    sourceHash: sha256(source),
    svgHash: sha256(rendered.svg),
    options: rendered.options,
    svg: rendered.svg,
    elements,
  }
}

export function checkedReceipt(receipt, svgFile) {
  const { svg: _, ...metadata } = receipt
  return { ...metadata, svgFile }
}

export function stableNativeIds(baseReceipt, revisionReceipt) {
  const revisionIds = new Set(
    revisionReceipt.elements.flatMap((element) =>
      element.id ? [element.id] : [],
    ),
  )

  return baseReceipt.elements.flatMap((element) =>
    element.id && revisionIds.has(element.id) ? [element.id] : [],
  )
}

export async function buildCheckedReceiptPair(language) {
  const files = sequenceReceiptFiles[language]
  const [source, revisionSource] = await Promise.all([
    readFile(new URL(files.source, fixtureDirectory), "utf8"),
    readFile(new URL(files.revisionSource, fixtureDirectory), "utf8"),
  ])
  const base = await renderSequenceReceipt(language, source)
  const revision = await renderSequenceReceipt(language, revisionSource)

  return {
    base,
    revision,
    checkedBase: checkedReceipt(base, files.svg),
    checkedRevision: checkedReceipt(revision, files.revisionSvg),
    stableIds: stableNativeIds(base, revision),
  }
}

export async function writeCheckedReceiptPair(language) {
  const files = sequenceReceiptFiles[language]
  const pair = await buildCheckedReceiptPair(language)

  await Promise.all([
    writeFile(new URL(files.svg, fixtureDirectory), pair.base.svg),
    writeFile(
      new URL(files.receipt, fixtureDirectory),
      `${JSON.stringify(pair.checkedBase, null, 2)}\n`,
    ),
    writeFile(new URL(files.revisionSvg, fixtureDirectory), pair.revision.svg),
    writeFile(
      new URL(files.revisionReceipt, fixtureDirectory),
      `${JSON.stringify(pair.checkedRevision, null, 2)}\n`,
    ),
  ])

  return pair
}

const invokedPath = process.argv[1]

if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  const languages = process.argv.slice(2)

  if (
    languages.length === 0 ||
    languages.some((language) => !sequenceReceiptFiles[language])
  ) {
    throw new Error(
      "usage: node scripts/2_sequenceRenderReceipts.mjs <mermaid|d2> [...]",
    )
  }

  for (const language of languages) {
    const pair = await writeCheckedReceiptPair(language)
    process.stdout.write(
      `${language} ${pair.base.svgHash} ${pair.revision.svgHash}\n`,
    )
  }
}
