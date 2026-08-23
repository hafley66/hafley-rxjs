import { readdir, readFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, test } from "vitest"
import { d2SequenceAdapter } from "@hafley66/d2"
import { buildSequenceArtifact, sequenceArtifactSchema, type NativeRenderReceipt, type SequenceSourceAdapter } from "@hafley66/grapht-model"
import { mermaidSequenceAdapter } from "@hafley66/mmd"

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..")
const packageDirectory = (name: string) => join(repositoryRoot, "packages", name)

async function packageManifest(name: string) {
  return JSON.parse(await readFile(join(packageDirectory(name), "package.json"), "utf8")) as {
    name: string
    dependencies?: Record<string, string>
  }
}

async function numberedSources(name: string) {
  return (await readdir(join(packageDirectory(name), "src")))
    .filter(filename => filename.endsWith(".ts") && filename !== "index.ts")
    .sort()
}

async function source(name: string, filename: string) {
  return readFile(join(packageDirectory(name), "src", filename), "utf8")
}

async function fixtureSource(filename: string) {
  return readFile(join(repositoryRoot, "fixtures", "sequence", filename), "utf8")
}

async function fixtureAdapter<LocalDocument>(
  adapter: SequenceSourceAdapter<LocalDocument>,
  language: "mermaid" | "d2",
): Promise<SequenceSourceAdapter<LocalDocument>> {
  const filenames = language === "mermaid"
    ? { receipt: "7_mermaid.receipt.json", svg: "6_mermaid.svg" }
    : { receipt: "11_d2.receipt.json", svg: "10_d2.svg" }
  const [metadata, svg] = await Promise.all([fixtureSource(filenames.receipt), fixtureSource(filenames.svg)])
  const receipt = { ...(JSON.parse(metadata) as Omit<NativeRenderReceipt, "svg">), svg }
  return { ...adapter, render: async () => receipt }
}

describe("sequence package gate", () => {
  test("keeps language adapters and the pure model in separate package boundaries", async () => {
    const [model, mmd, d2, grapht, modelSources, mmdSources, d2Sources, mmdAdapter, d2Adapter] = await Promise.all([
      packageManifest("grapht-model"),
      packageManifest("mmd"),
      packageManifest("d2"),
      packageManifest("grapht"),
      numberedSources("grapht-model"),
      numberedSources("mmd"),
      numberedSources("d2"),
      source("mmd", "4_sequenceAdapter.ts"),
      source("d2", "4_sequenceAdapter.ts"),
    ])

    expect({
      names: [model.name, mmd.name, d2.name],
      dependencies: {
        mmd: mmd.dependencies?.["@hafley66/grapht-model"],
        d2: d2.dependencies?.["@hafley66/grapht-model"],
        grapht: grapht.dependencies?.["@hafley66/grapht-model"],
        model: model.dependencies,
      },
      modelSources,
      nonNumericSources: {
        model: modelSources.filter(filename => !/^\d+_/.test(filename)),
        mmd: mmdSources.filter(filename => !/^\d+_/.test(filename)),
        d2: d2Sources.filter(filename => !/^\d+_/.test(filename)),
      },
      adapterImports: {
        mmdUsesModel: mmdAdapter.includes('from "@hafley66/grapht-model"'),
        d2UsesModel: d2Adapter.includes('from "@hafley66/grapht-model"'),
        mmdReachesGraphtSource: mmdAdapter.includes("../../grapht/src"),
        d2ReachesGraphtSource: d2Adapter.includes("../../grapht/src"),
      },
    }).toEqual({
      names: ["@hafley66/grapht-model", "@hafley66/mmd", "@hafley66/d2"],
      dependencies: {
        mmd: "workspace:*",
        d2: "workspace:*",
        grapht: "workspace:*",
        model: { zod: "^4.4.3" },
      },
      modelSources: [
        "0_sequenceIdentity.ts",
        "1_sequenceSvgBinding.ts",
        "2_sequenceArtifact.ts",
        "3_sequenceFocus.ts",
        "4_sequencePlacement.ts",
      ],
      nonNumericSources: { model: [], mmd: [], d2: [] },
      adapterImports: {
        mmdUsesModel: true,
        d2UsesModel: true,
        mmdReachesGraphtSource: false,
        d2ReachesGraphtSource: false,
      },
    })
  })

  test("keeps the model pure and browser board sources parser-free", async () => {
    const [modelSources, geometry, board] = await Promise.all([
      numberedSources("grapht-model"),
      source("grapht", "15_sequenceGeometry.ts"),
      source("grapht", "17_sequenceBoard.ts"),
    ])
    const model = await Promise.all(modelSources.map(filename => source("grapht-model", filename)))
    const forbiddenModelDependencies = /from\s+["'][^"']*(?:mermaid|\bd2\b|playwright|puppeteer|react)[^"']*["']/i

    expect({
      modelForbiddenReferences: modelSources.flatMap((filename, index) => {
        const text = model[index]
        return forbiddenModelDependencies.test(text) || /\bDOMParser\b|\bdocument\.(?:query|create|body|fonts)\b|\bwindow\.|\bHTMLElement\b/.test(text)
          ? [filename]
          : []
      }),
      geometryParserReferences: /(?:parseMermaid|parseD2|mermaidSequenceAdapter|d2SequenceAdapter)/.test(geometry),
      boardParserReferences: /(?:parseMermaid|parseD2|mermaidSequenceAdapter|d2SequenceAdapter)/.test(board),
    }).toEqual({
      modelForbiddenReferences: [],
      geometryParserReferences: false,
      boardParserReferences: false,
    })
  })

  test("serializes Mermaid and D2 through public package boundaries", async () => {
    const [mermaidSource, d2Source, mermaidAdapter, d2Adapter] = await Promise.all([
      fixtureSource("0_mermaid.mmd"),
      fixtureSource("2_d2.d2"),
      fixtureAdapter(mermaidSequenceAdapter, "mermaid"),
      fixtureAdapter(d2SequenceAdapter, "d2"),
    ])
    const [mermaid, d2] = await Promise.all([
      buildSequenceArtifact(mermaidAdapter, { locator: "fixtures/sequence/0_mermaid.mmd", source: mermaidSource }),
      buildSequenceArtifact(d2Adapter, { locator: "fixtures/sequence/2_d2.d2", source: d2Source }),
    ])
    const serialized = { mermaid: JSON.parse(JSON.stringify(mermaid.artifact)), d2: JSON.parse(JSON.stringify(d2.artifact)) }

    expect({
      mermaid: {
        protocol: serialized.mermaid.protocol,
        valid: sequenceArtifactSchema.safeParse(serialized.mermaid).success,
        hasLocalDocument: Object.hasOwn(serialized.mermaid, "localDocument"),
        occurrenceKinds: serialized.mermaid.occurrences.map((occurrence: { kind: string }) => occurrence.kind).sort(),
        relationKinds: serialized.mermaid.relations.map((relation: { kind: string }) => relation.kind).sort(),
      },
      d2: {
        protocol: serialized.d2.protocol,
        valid: sequenceArtifactSchema.safeParse(serialized.d2).success,
        hasLocalDocument: Object.hasOwn(serialized.d2, "localDocument"),
        occurrenceKinds: serialized.d2.occurrences.map((occurrence: { kind: string }) => occurrence.kind).sort(),
        relationKinds: serialized.d2.relations.map((relation: { kind: string }) => relation.kind).sort(),
      },
    }).toMatchInlineSnapshot(`
      {
        "d2": {
          "hasLocalDocument": false,
          "occurrenceKinds": [
            "activation",
            "actor",
            "actor",
            "actor",
            "group",
            "group",
            "message",
            "message",
            "message",
            "message",
            "note",
          ],
          "protocol": "grapht-sequence/0",
          "relationKinds": [
            "activates",
            "contains",
            "contains",
            "contains",
            "contains",
            "contains",
            "contains",
            "message",
            "message",
            "message",
            "message",
          ],
          "valid": true,
        },
        "mermaid": {
          "hasLocalDocument": false,
          "occurrenceKinds": [
            "activation",
            "actor",
            "actor",
            "actor",
            "group",
            "group",
            "message",
            "message",
            "message",
            "message",
            "note",
          ],
          "protocol": "grapht-sequence/0",
          "relationKinds": [
            "activates",
            "contains",
            "contains",
            "contains",
            "contains",
            "contains",
            "contains",
            "message",
            "message",
            "message",
            "message",
          ],
          "valid": true,
        },
      }
    `)
  })
})
