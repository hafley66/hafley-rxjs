import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { chromium } from "playwright"
import { afterAll, beforeAll, describe, expect, test } from "vitest"
import { createServer, type ViteDevServer } from "vite"
import { d2SequenceAdapter } from "../../d2/src/index.js"
import { mermaidSequenceAdapter } from "../../mmd/src/index.js"
import { documentFingerprint } from "../src/12_sequenceIdentity.js"
import { buildSequenceArtifact, measureSequenceSvg } from "../src/index.js"

let server: ViteDevServer
let serverUrl = ""

beforeAll(async () => {
  server = await createServer({
    root: process.cwd(),
    logLevel: "error",
    optimizeDeps: { noDiscovery: true },
    server: { host: "127.0.0.1", port: 0 },
  })
  await server.listen()
  const address = server.httpServer?.address()
  if (!address || typeof address === "string") throw new Error("sequence board Vite server did not expose a TCP address")
  serverUrl = `http://127.0.0.1:${address.port}`
})

afterAll(async () => {
  await server.close()
})

async function receipt(language: "mermaid" | "d2") {
  const filename = language === "mermaid" ? "0_mermaid.mmd" : "2_d2.d2"
  const source = await readFile(join(process.cwd(), "fixtures", "sequence", filename), "utf8")
  const built = language === "mermaid"
    ? await buildSequenceArtifact(mermaidSequenceAdapter, { locator: filename, source })
    : await buildSequenceArtifact(d2SequenceAdapter, { locator: filename, source })
  const geometry = await measureSequenceSvg(built.artifact, built.bindingReceipt, built.renderReceipt)
  const archiveMessageId = built.artifact.occurrences.find(occurrence => occurrence.kind === "message" && occurrence.label === "archive")?.id
  if (!archiveMessageId) throw new Error(`expected ${language} archive message`)
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 320, height: 220 }, deviceScaleFactor: 1 })
    await page.goto(serverUrl)
    await page.addScriptTag({
      type: "module",
      content: `import { createSequenceBoard } from "/packages/grapht/src/17_sequenceBoard.ts"; window.createSequenceBoard = createSequenceBoard;`,
    })
    await page.waitForFunction(() => "createSequenceBoard" in window)
    const json = await page.evaluate(
      ({ input, occurrenceId }) => {
        const createSequenceBoard = (window as typeof window & { createSequenceBoard: typeof import("../src/17_sequenceBoard.js").createSequenceBoard }).createSequenceBoard
        const host = document.body.appendChild(document.createElement("div"))
        const board = createSequenceBoard(host, { width: 280, height: 180 })
        board.replace(input)
        board.setCamera({ x: 0, y: -120, scale: 1 })
        board.focus(occurrenceId)
        const bounds = (selector: string) => [...host.querySelectorAll<SVGElement>(selector)].map(element => {
          const rect = element.getBoundingClientRect()
          return { width: rect.width, height: rect.height, top: rect.top, bottom: rect.bottom }
        })
        return {
          ...board.receipt(),
          stickyActorBounds: bounds("[data-sequence-sticky-actor-id]"),
          stickyGroupBounds: bounds("[data-sequence-sticky-group-id]"),
          hiddenBottomActorCells: host.querySelectorAll('[data-sequence-bottom-actor="hidden"]').length,
        }
      },
      { input: { artifact: built.artifact, bindingReceipt: built.bindingReceipt, geometry, renderReceipt: built.renderReceipt }, occurrenceId: archiveMessageId },
    )
    const png = await page.screenshot({ type: "png" })
    return { json, pngBytes: png.byteLength, pngHash: documentFingerprint(png.toString("base64")) }
  } finally {
    await browser.close()
  }
}

describe("sequence board Playwright receipts", () => {
  test("projects Mermaid and D2 through the same browser API with JSON and PNG receipts", async () => {
    expect(await Promise.all([receipt("mermaid"), receipt("d2")])).toMatchInlineSnapshot(`
      [
        {
          "json": {
            "actorLabelIds": [
              "mermaid:092e83e2:participant:alice#0",
              "mermaid:092e83e2:participant:bob#1",
              "mermaid:092e83e2:participant:archive#2",
            ],
            "camera": {
              "scale": 1,
              "x": 0,
              "y": -120,
            },
            "focus": {
              "actorIds": [
                "mermaid:092e83e2:participant:bob#1",
                "mermaid:092e83e2:participant:archive#2",
              ],
              "groupIds": [],
              "hoveredOccurrenceId": "mermaid:092e83e2:message:bob->>archive:archive#8",
            },
            "focusOverlayActorIds": [
              "mermaid:092e83e2:participant:bob#1",
              "mermaid:092e83e2:participant:archive#2",
            ],
            "geometryId": "geometry:20befaf4",
            "hiddenBottomActorCells": 3,
            "listenerCount": 2,
            "mounted": true,
            "renderRevisionId": "render:9db3c6f8",
            "stickyActorBounds": [
              {
                "bottom": 83,
                "height": 65,
                "top": 18,
                "width": 150,
              },
              {
                "bottom": 83,
                "height": 65,
                "top": 18,
                "width": 150,
              },
              {
                "bottom": 83,
                "height": 65,
                "top": 18,
                "width": 201,
              },
            ],
            "stickyGroupBounds": [
              {
                "bottom": 110,
                "height": 26,
                "top": 84,
                "width": 131.15518188476562,
              },
              {
                "bottom": 134,
                "height": 26,
                "top": 108,
                "width": 119.57611083984375,
              },
            ],
          },
          "pngBytes": 8938,
          "pngHash": "76c0f6b0",
        },
        {
          "json": {
            "actorLabelIds": [
              "d2:49a15df1:actor:alice#0",
              "d2:49a15df1:actor:bob#1",
              "d2:49a15df1:actor:archive#2",
            ],
            "camera": {
              "scale": 1,
              "x": 0,
              "y": -120,
            },
            "focus": {
              "actorIds": [
                "d2:49a15df1:actor:bob#1",
                "d2:49a15df1:actor:archive#2",
              ],
              "groupIds": [],
              "hoveredOccurrenceId": "d2:49a15df1:edge:bob->archive:archive#7",
            },
            "focusOverlayActorIds": [
              "d2:49a15df1:actor:bob#1",
              "d2:49a15df1:actor:archive#2",
            ],
            "geometryId": "geometry:65ed6bd7",
            "hiddenBottomActorCells": 0,
            "listenerCount": 2,
            "mounted": true,
            "renderRevisionId": "render:65e979a0",
            "stickyActorBounds": [
              {
                "bottom": 74,
                "height": 66,
                "top": 8,
                "width": 100,
              },
              {
                "bottom": 74,
                "height": 66,
                "top": 8,
                "width": 100,
              },
              {
                "bottom": 74,
                "height": 66,
                "top": 8,
                "width": 211,
              },
            ],
            "stickyGroupBounds": [
              {
                "bottom": 129.26513671875,
                "height": 26.114540100097656,
                "top": 103.15059661865234,
                "width": 115.3070068359375,
              },
              {
                "bottom": 172.51138305664062,
                "height": 26.114532470703125,
                "top": 146.3968505859375,
                "width": 105.09259796142578,
              },
            ],
          },
          "pngBytes": 11931,
          "pngHash": "c69396ba",
        },
      ]
    `)
  }, 60_000)
})
