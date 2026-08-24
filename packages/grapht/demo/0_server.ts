import { readFile } from "node:fs/promises"
import type { IncomingMessage, ServerResponse } from "node:http"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { d2SequenceAdapter } from "../../d2/src/index.js"
import { mermaidSequenceAdapter } from "../../mmd/src/index.js"
import { buildSequenceArtifact } from "../src/14_sequenceArtifact.js"
import { measureSequenceSvg } from "../src/15_sequenceGeometry.js"

export type SequenceDemoLanguage = "mermaid" | "d2"

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..")
const fixture = {
  mermaid: "0_mermaid.mmd",
  d2: "2_d2.d2",
} satisfies Record<SequenceDemoLanguage, string>

async function createDemoInput(language: SequenceDemoLanguage) {
  const filename = fixture[language]
  const source = await readFile(join(repositoryRoot, "fixtures", "sequence", filename), "utf8")
  const built = language === "mermaid"
    ? await buildSequenceArtifact(mermaidSequenceAdapter, { locator: filename, source })
    : await buildSequenceArtifact(d2SequenceAdapter, { locator: filename, source })
  const geometry = await measureSequenceSvg(built.artifact, built.bindingReceipt, built.renderReceipt)

  return {
    input: {
      artifact: built.artifact,
      bindingReceipt: built.bindingReceipt,
      geometry,
      renderReceipt: built.renderReceipt,
    },
    source,
  }
}

function respond(response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status
  response.setHeader("content-type", "application/json; charset=utf-8")
  response.end(JSON.stringify(body))
}

export function sequenceDemoMiddleware() {
  const cache = new Map<SequenceDemoLanguage, Promise<Awaited<ReturnType<typeof createDemoInput>>>>()

  return async (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    const match = request.url?.match(/^\/api\/sequence\/(mermaid|d2)$/)
    if (!match) return next()

    const language = match[1] as SequenceDemoLanguage
    try {
      const pending = cache.get(language) ?? createDemoInput(language)
      cache.set(language, pending)
      respond(response, 200, await pending)
    } catch (error) {
      cache.delete(language)
      respond(response, 500, { error: error instanceof Error ? error.message : String(error) })
    }
  }
}
