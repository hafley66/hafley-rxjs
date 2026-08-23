// @vitest-environment jsdom

import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { describe, expect, test, vi } from "vitest"
import { d2SequenceAdapter } from "../../d2/src/index.js"
import { mermaidSequenceAdapter } from "../../mmd/src/index.js"
import { createSequenceBoard, buildSequenceArtifact, measureSequenceSvg } from "../src/index.js"

async function boardInput(language: "mermaid" | "d2") {
  const filename = language === "mermaid" ? "0_mermaid.mmd" : "2_d2.d2"
  const source = await readFile(join(process.cwd(), "fixtures", "sequence", filename), "utf8")
  const built = language === "mermaid"
    ? await buildSequenceArtifact(mermaidSequenceAdapter, { locator: filename, source })
    : await buildSequenceArtifact(d2SequenceAdapter, { locator: filename, source })
  const geometry = await measureSequenceSvg(built.artifact, built.bindingReceipt, built.renderReceipt)
  return { ...built, geometry }
}

describe("sequence board projection", () => {
  test("mounts both adapters through one API, focuses endpoints, and preserves overlay labels across a vertical camera move", async () => {
    const [mermaid, d2] = await Promise.all([boardInput("mermaid"), boardInput("d2")])
    const host = document.body.appendChild(document.createElement("div"))
    const board = createSequenceBoard(host, { width: 280, height: 180 })

    board.replace(mermaid)
    const mermaidMessage = mermaid.artifact.occurrences.find(occurrence => occurrence.kind === "message" && occurrence.label === "repeat")
    if (!mermaidMessage) throw new Error("expected Mermaid repeat message")
    board.focus(mermaidMessage.id)

    expect(board.receipt()).toMatchInlineSnapshot(`
      {
        "actorLabelIds": [
          "mermaid:092e83e2:participant:alice#0",
          "mermaid:092e83e2:participant:bob#1",
          "mermaid:092e83e2:participant:archive#2",
        ],
        "camera": {
          "scale": 1,
          "x": 0,
          "y": 0,
        },
        "focus": {
          "actorIds": [
            "mermaid:092e83e2:participant:alice#0",
            "mermaid:092e83e2:participant:bob#1",
          ],
          "groupIds": [
            "mermaid:092e83e2:group:loop:outer exchange#0",
            "mermaid:092e83e2:group:alt:nested review#1",
          ],
          "hoveredOccurrenceId": "mermaid:092e83e2:message:alice->>bob:repeat#2",
        },
        "focusOverlayActorIds": [
          "mermaid:092e83e2:participant:bob#1",
        ],
        "geometryId": "geometry:eb1930fb",
        "listenerCount": 2,
        "mounted": true,
        "renderRevisionId": "render:9db3c6f8",
      }
    `)

    board.setCamera({ x: 0, y: -140, scale: 1 })
    expect(host.querySelectorAll("[data-sequence-actor-label]").length).toBe(3)

    board.replace(d2)
    const d2Message = d2.artifact.occurrences.find(occurrence => occurrence.kind === "message" && occurrence.label === "repeat")
    const d2Activation = d2.artifact.occurrences.find(occurrence => occurrence.kind === "activation")
    if (!d2Message || !d2Activation) throw new Error("expected D2 message and activation")
    board.focus(d2Message.id)
    const messageFocus = board.receipt()
    board.focus(d2Activation.id)
    const activationFocus = board.receipt()

    expect({ messageFocus, activationFocus }).toMatchInlineSnapshot(`
      {
        "activationFocus": {
          "actorLabelIds": [
            "d2:49a15df1:actor:alice#0",
            "d2:49a15df1:actor:bob#1",
            "d2:49a15df1:actor:archive#2",
          ],
          "camera": {
            "scale": 1,
            "x": 0,
            "y": -140,
          },
          "focus": {
            "actorIds": [
              "d2:49a15df1:actor:bob#1",
            ],
            "groupIds": [
              "d2:49a15df1:group:outer exchange#0",
              "d2:49a15df1:group:nested review#1",
            ],
            "hoveredOccurrenceId": "d2:49a15df1:span:bob.work#0",
          },
          "focusOverlayActorIds": [
            "d2:49a15df1:actor:bob#1",
          ],
          "geometryId": "geometry:65ed6bd7",
          "listenerCount": 2,
          "mounted": true,
          "renderRevisionId": "render:65e979a0",
        },
        "messageFocus": {
          "actorLabelIds": [
            "d2:49a15df1:actor:alice#0",
            "d2:49a15df1:actor:bob#1",
            "d2:49a15df1:actor:archive#2",
          ],
          "camera": {
            "scale": 1,
            "x": 0,
            "y": -140,
          },
          "focus": {
            "actorIds": [
              "d2:49a15df1:actor:alice#0",
              "d2:49a15df1:actor:bob#1",
            ],
            "groupIds": [
              "d2:49a15df1:group:outer exchange#0",
              "d2:49a15df1:group:nested review#1",
            ],
            "hoveredOccurrenceId": "d2:49a15df1:edge:alice->bob.work:repeat#3",
          },
          "focusOverlayActorIds": [
            "d2:49a15df1:actor:bob#1",
          ],
          "geometryId": "geometry:65ed6bd7",
          "listenerCount": 2,
          "mounted": true,
          "renderRevisionId": "render:65e979a0",
        },
      }
    `)

    board.unmount()
    expect(board.receipt()).toMatchInlineSnapshot(`
      {
        "actorLabelIds": [],
        "camera": {
          "scale": 1,
          "x": 0,
          "y": -140,
        },
        "focus": {
          "actorIds": [],
          "groupIds": [],
        },
        "focusOverlayActorIds": [],
        "listenerCount": 0,
        "mounted": false,
      }
    `)
    host.remove()
  }, 60_000)

  test("keeps the mounted revision when replacement geometry is mismatched and removes delegated listeners on unmount", async () => {
    const mermaid = await boardInput("mermaid")
    const host = document.body.appendChild(document.createElement("div"))
    const board = createSequenceBoard(host, { width: 280, height: 180 })
    board.replace(mermaid)
    const before = board.receipt()
    const beforeMarkup = host.innerHTML

    expect(() => board.replace({ ...mermaid, geometry: { ...mermaid.geometry, renderRevisionId: "render:mismatch" } })).toThrowError(
      "sequence board geometry render revision does not match artifact",
    )
    expect(board.receipt()).toEqual(before)
    expect(host.innerHTML).toBe(beforeMarkup)

    const removeEventListener = vi.spyOn(host, "removeEventListener")
    board.unmount()
    expect(board.listenerCount()).toBe(0)
    expect(removeEventListener.mock.calls.map(([type]) => type)).toEqual(["pointerover", "pointerout"])
    host.remove()
  }, 60_000)
})
