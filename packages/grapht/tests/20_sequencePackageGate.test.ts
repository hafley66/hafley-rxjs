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
        artifact: serialized.mermaid,
        protocol: serialized.mermaid.protocol,
        valid: sequenceArtifactSchema.safeParse(serialized.mermaid).success,
        hasLocalDocument: Object.hasOwn(serialized.mermaid, "localDocument"),
        occurrenceKinds: serialized.mermaid.occurrences.map((occurrence: { kind: string }) => occurrence.kind).sort(),
        relationKinds: serialized.mermaid.relations.map((relation: { kind: string }) => relation.kind).sort(),
      },
      d2: {
        artifact: serialized.d2,
        protocol: serialized.d2.protocol,
        valid: sequenceArtifactSchema.safeParse(serialized.d2).success,
        hasLocalDocument: Object.hasOwn(serialized.d2, "localDocument"),
        occurrenceKinds: serialized.d2.occurrences.map((occurrence: { kind: string }) => occurrence.kind).sort(),
        relationKinds: serialized.d2.relations.map((relation: { kind: string }) => relation.kind).sort(),
      },
    }).toMatchInlineSnapshot(`
      {
        "d2": {
          "artifact": {
            "bindingRevision": {
              "adapterVersion": "d2-sequence-adapter/0",
              "bindingHash": "901ab7f2",
              "id": "binding:6d556589",
              "renderRevisionId": "render:5b82a5bf",
              "sourceRevisionId": "source:c2e8fa5b",
            },
            "bindings": [
              {
                "elementId": "sequence-binding-d2-5686a2c3",
                "occurrenceId": "d2:49a15df1:actor:alice#0",
                "ordinal": 0,
                "role": "actor-shape",
              },
              {
                "elementId": "sequence-binding-d2-dcb86258",
                "occurrenceId": "d2:49a15df1:actor:alice#0",
                "ordinal": 0,
                "role": "actor-label",
              },
              {
                "elementId": "sequence-binding-d2-607c41d0",
                "occurrenceId": "d2:49a15df1:actor:alice#0",
                "ordinal": 0,
                "role": "lifeline",
              },
              {
                "elementId": "sequence-binding-d2-40d43223",
                "occurrenceId": "d2:49a15df1:actor:bob#1",
                "ordinal": 0,
                "role": "actor-shape",
              },
              {
                "elementId": "sequence-binding-d2-82950ab8",
                "occurrenceId": "d2:49a15df1:actor:bob#1",
                "ordinal": 0,
                "role": "actor-label",
              },
              {
                "elementId": "sequence-binding-d2-24da1db0",
                "occurrenceId": "d2:49a15df1:actor:bob#1",
                "ordinal": 0,
                "role": "lifeline",
              },
              {
                "elementId": "sequence-binding-d2-44cad067",
                "occurrenceId": "d2:49a15df1:actor:archive#2",
                "ordinal": 0,
                "role": "actor-shape",
              },
              {
                "elementId": "sequence-binding-d2-1929d2bc",
                "occurrenceId": "d2:49a15df1:actor:archive#2",
                "ordinal": 0,
                "role": "actor-label",
              },
              {
                "elementId": "sequence-binding-d2-ec3f282c",
                "occurrenceId": "d2:49a15df1:actor:archive#2",
                "ordinal": 0,
                "role": "lifeline",
              },
              {
                "elementId": "sequence-binding-d2-c366505f",
                "occurrenceId": "d2:49a15df1:edge:alice->bob.work:repeat#3",
                "ordinal": 0,
                "role": "message-line",
              },
              {
                "elementId": "sequence-binding-d2-b210426b",
                "occurrenceId": "d2:49a15df1:edge:alice->bob.work:repeat#3",
                "ordinal": 0,
                "role": "message-label",
              },
              {
                "elementId": "sequence-binding-d2-fa2695f1",
                "occurrenceId": "d2:49a15df1:edge:bob.work->bob.work:inspect#4",
                "ordinal": 0,
                "role": "message-line",
              },
              {
                "elementId": "sequence-binding-d2-f3738e51",
                "occurrenceId": "d2:49a15df1:edge:bob.work->bob.work:inspect#4",
                "ordinal": 0,
                "role": "message-label",
              },
              {
                "elementId": "sequence-binding-d2-5a73210e",
                "occurrenceId": "d2:49a15df1:edge:alice->bob.work:repeat#6",
                "ordinal": 0,
                "role": "message-line",
              },
              {
                "elementId": "sequence-binding-d2-cf86ec80",
                "occurrenceId": "d2:49a15df1:edge:alice->bob.work:repeat#6",
                "ordinal": 0,
                "role": "message-label",
              },
              {
                "elementId": "sequence-binding-d2-b8106a07",
                "occurrenceId": "d2:49a15df1:edge:bob->archive:archive#7",
                "ordinal": 0,
                "role": "message-line",
              },
              {
                "elementId": "sequence-binding-d2-950b35b3",
                "occurrenceId": "d2:49a15df1:edge:bob->archive:archive#7",
                "ordinal": 0,
                "role": "message-label",
              },
              {
                "elementId": "sequence-binding-d2-9b97abd7",
                "occurrenceId": "d2:49a15df1:group:outer exchange#0",
                "ordinal": 0,
                "role": "group-frame",
              },
              {
                "elementId": "sequence-binding-d2-b12c75ec",
                "occurrenceId": "d2:49a15df1:group:outer exchange#0",
                "ordinal": 0,
                "role": "group-label",
              },
              {
                "elementId": "sequence-binding-d2-d554815d",
                "occurrenceId": "d2:49a15df1:group:nested review#1",
                "ordinal": 0,
                "role": "group-frame",
              },
              {
                "elementId": "sequence-binding-d2-8dffebf6",
                "occurrenceId": "d2:49a15df1:group:nested review#1",
                "ordinal": 0,
                "role": "group-label",
              },
              {
                "elementId": "sequence-binding-d2-ee30eeb1",
                "occurrenceId": "d2:49a15df1:span:bob.work#0",
                "ordinal": 0,
                "role": "activation",
              },
              {
                "elementId": "sequence-binding-d2-22d744bc",
                "occurrenceId": "d2:49a15df1:note:bob:local note#5",
                "ordinal": 0,
                "role": "note-shape",
              },
              {
                "elementId": "sequence-binding-d2-14282777",
                "occurrenceId": "d2:49a15df1:note:bob:local note#5",
                "ordinal": 0,
                "role": "note-label",
              },
            ],
            "language": "d2",
            "occurrences": [
              {
                "authoredId": "alice",
                "id": "d2:49a15df1:actor:alice#0",
                "kind": "actor",
                "label": "Alice",
                "ordinal": 0,
                "sourceSpan": {
                  "end": 36,
                  "lineEnd": 2,
                  "lineStart": 2,
                  "start": 24,
                },
                "structuralKey": "actor:alice",
              },
              {
                "authoredId": "bob",
                "id": "d2:49a15df1:actor:bob#1",
                "kind": "actor",
                "label": "Bob",
                "ordinal": 1,
                "sourceSpan": {
                  "end": 45,
                  "lineEnd": 3,
                  "lineStart": 3,
                  "start": 37,
                },
                "structuralKey": "actor:bob",
              },
              {
                "authoredId": "archive",
                "id": "d2:49a15df1:actor:archive#2",
                "kind": "actor",
                "label": "Archive Service Far Right",
                "ordinal": 2,
                "sourceSpan": {
                  "end": 80,
                  "lineEnd": 4,
                  "lineStart": 4,
                  "start": 46,
                },
                "structuralKey": "actor:archive",
              },
              {
                "id": "d2:49a15df1:group:outer exchange#0",
                "kind": "group",
                "label": "outer exchange",
                "ordinal": 1,
                "sourceSpan": {
                  "end": 238,
                  "lineEnd": 12,
                  "lineStart": 5,
                  "start": 81,
                },
                "structuralKey": "group:root/outer exchange",
              },
              {
                "id": "d2:49a15df1:group:nested review#1",
                "kind": "group",
                "label": "nested review",
                "ordinal": 2,
                "parentId": "d2:49a15df1:group:outer exchange#0",
                "sourceSpan": {
                  "end": 236,
                  "lineEnd": 11,
                  "lineStart": 6,
                  "start": 101,
                },
                "structuralKey": "group:group:root/outer exchange/nested review",
              },
              {
                "id": "d2:49a15df1:edge:alice->bob.work:repeat#3",
                "kind": "message",
                "label": "repeat",
                "ordinal": 3,
                "parentId": "d2:49a15df1:group:nested review#1",
                "sourceSpan": {
                  "end": 147,
                  "lineEnd": 7,
                  "lineStart": 7,
                  "start": 122,
                },
                "structuralKey": "message:group:group:root/outer exchange/nested review/alice->bob.work:repeat",
              },
              {
                "id": "d2:49a15df1:edge:bob.work->bob.work:inspect#4",
                "kind": "message",
                "label": "inspect",
                "ordinal": 4,
                "parentId": "d2:49a15df1:group:nested review#1",
                "sourceSpan": {
                  "end": 181,
                  "lineEnd": 8,
                  "lineStart": 8,
                  "start": 152,
                },
                "structuralKey": "message:group:group:root/outer exchange/nested review/bob.work->bob.work:inspect",
              },
              {
                "id": "d2:49a15df1:note:bob:local note#5",
                "kind": "note",
                "label": "local note",
                "ordinal": 5,
                "parentId": "d2:49a15df1:group:nested review#1",
                "sourceSpan": {
                  "end": 202,
                  "lineEnd": 9,
                  "lineStart": 9,
                  "start": 186,
                },
                "structuralKey": "note:group:group:root/outer exchange/nested review/bob:local note",
              },
              {
                "id": "d2:49a15df1:edge:alice->bob.work:repeat#6",
                "kind": "message",
                "label": "repeat",
                "ordinal": 6,
                "parentId": "d2:49a15df1:group:nested review#1",
                "sourceSpan": {
                  "end": 232,
                  "lineEnd": 10,
                  "lineStart": 10,
                  "start": 207,
                },
                "structuralKey": "message:group:group:root/outer exchange/nested review/alice->bob.work:repeat",
              },
              {
                "id": "d2:49a15df1:edge:bob->archive:archive#7",
                "kind": "message",
                "label": "archive",
                "ordinal": 7,
                "sourceSpan": {
                  "end": 262,
                  "lineEnd": 13,
                  "lineStart": 13,
                  "start": 239,
                },
                "structuralKey": "message:root/bob->archive:archive",
              },
              {
                "authoredId": "bob.work",
                "id": "d2:49a15df1:span:bob.work#0",
                "kind": "activation",
                "label": "work",
                "ordinal": 0,
                "parentId": "d2:49a15df1:group:nested review#1",
                "sourceSpan": {
                  "end": 139,
                  "lineEnd": 7,
                  "lineStart": 7,
                  "start": 131,
                },
                "structuralKey": "activation:group:group:root/outer exchange/nested review/bob.work",
              },
            ],
            "protocol": "grapht-sequence/0",
            "relations": [
              {
                "id": "d2:49a15df1:relation:0",
                "kind": "contains",
                "ordinal": 0,
                "sourceId": "d2:49a15df1:group:outer exchange#0",
                "targetId": "d2:49a15df1:group:nested review#1",
              },
              {
                "id": "d2:49a15df1:relation:1",
                "kind": "contains",
                "ordinal": 1,
                "sourceId": "d2:49a15df1:group:nested review#1",
                "targetId": "d2:49a15df1:edge:alice->bob.work:repeat#3",
              },
              {
                "id": "d2:49a15df1:relation:2",
                "kind": "message",
                "occurrenceId": "d2:49a15df1:edge:alice->bob.work:repeat#3",
                "ordinal": 2,
                "sourceId": "d2:49a15df1:actor:alice#0",
                "targetId": "d2:49a15df1:actor:bob#1",
              },
              {
                "id": "d2:49a15df1:relation:3",
                "kind": "contains",
                "ordinal": 3,
                "sourceId": "d2:49a15df1:group:nested review#1",
                "targetId": "d2:49a15df1:edge:bob.work->bob.work:inspect#4",
              },
              {
                "id": "d2:49a15df1:relation:4",
                "kind": "message",
                "occurrenceId": "d2:49a15df1:edge:bob.work->bob.work:inspect#4",
                "ordinal": 4,
                "sourceId": "d2:49a15df1:actor:bob#1",
                "targetId": "d2:49a15df1:actor:bob#1",
              },
              {
                "id": "d2:49a15df1:relation:5",
                "kind": "contains",
                "ordinal": 5,
                "sourceId": "d2:49a15df1:group:nested review#1",
                "targetId": "d2:49a15df1:note:bob:local note#5",
              },
              {
                "id": "d2:49a15df1:relation:6",
                "kind": "contains",
                "ordinal": 6,
                "sourceId": "d2:49a15df1:group:nested review#1",
                "targetId": "d2:49a15df1:edge:alice->bob.work:repeat#6",
              },
              {
                "id": "d2:49a15df1:relation:7",
                "kind": "message",
                "occurrenceId": "d2:49a15df1:edge:alice->bob.work:repeat#6",
                "ordinal": 7,
                "sourceId": "d2:49a15df1:actor:alice#0",
                "targetId": "d2:49a15df1:actor:bob#1",
              },
              {
                "id": "d2:49a15df1:relation:8",
                "kind": "message",
                "occurrenceId": "d2:49a15df1:edge:bob->archive:archive#7",
                "ordinal": 8,
                "sourceId": "d2:49a15df1:actor:bob#1",
                "targetId": "d2:49a15df1:actor:archive#2",
              },
              {
                "id": "d2:49a15df1:relation:9",
                "kind": "contains",
                "ordinal": 9,
                "sourceId": "d2:49a15df1:group:nested review#1",
                "targetId": "d2:49a15df1:span:bob.work#0",
              },
              {
                "id": "d2:49a15df1:relation:10",
                "kind": "activates",
                "occurrenceId": "d2:49a15df1:span:bob.work#0",
                "ordinal": 10,
                "sourceId": "d2:49a15df1:span:bob.work#0",
                "targetId": "d2:49a15df1:actor:bob#1",
              },
            ],
            "renderRevision": {
              "id": "render:5b82a5bf",
              "rendererOptionsHash": "7ea1e21a",
              "rendererPackage": "d2",
              "rendererVersion": "0.7.1",
              "sourceRevisionId": "source:c2e8fa5b",
            },
            "sourceRevision": {
              "adapterVersion": "d2-sequence-adapter/0",
              "id": "source:c2e8fa5b",
              "locator": "fixtures/sequence/2_d2.d2",
              "sourceHash": "4d4876c9",
            },
          },
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
          "artifact": {
            "bindingRevision": {
              "adapterVersion": "mermaid-sequence-adapter/0",
              "bindingHash": "13e89648",
              "id": "binding:41818259",
              "renderRevisionId": "render:fa11e65f",
              "sourceRevisionId": "source:10b3b203",
            },
            "bindings": [
              {
                "elementId": "sequence-binding-mermaid-70e330fd",
                "occurrenceId": "mermaid:092e83e2:participant:alice#0",
                "ordinal": 0,
                "role": "actor-shape",
              },
              {
                "elementId": "sequence-binding-mermaid-6a1ca752",
                "occurrenceId": "mermaid:092e83e2:participant:alice#0",
                "ordinal": 0,
                "role": "actor-label",
              },
              {
                "elementId": "sequence-binding-mermaid-1a096f15",
                "occurrenceId": "mermaid:092e83e2:participant:alice#0",
                "ordinal": 0,
                "role": "actor-bottom-shape",
              },
              {
                "elementId": "sequence-binding-mermaid-bef6b25a",
                "occurrenceId": "mermaid:092e83e2:participant:alice#0",
                "ordinal": 0,
                "role": "actor-bottom-label",
              },
              {
                "elementId": "actor0",
                "occurrenceId": "mermaid:092e83e2:participant:alice#0",
                "ordinal": 0,
                "role": "lifeline",
              },
              {
                "elementId": "sequence-binding-mermaid-8e7a5f7d",
                "occurrenceId": "mermaid:092e83e2:participant:bob#1",
                "ordinal": 0,
                "role": "actor-shape",
              },
              {
                "elementId": "sequence-binding-mermaid-87b3d5d2",
                "occurrenceId": "mermaid:092e83e2:participant:bob#1",
                "ordinal": 0,
                "role": "actor-label",
              },
              {
                "elementId": "sequence-binding-mermaid-e27a0695",
                "occurrenceId": "mermaid:092e83e2:participant:bob#1",
                "ordinal": 0,
                "role": "actor-bottom-shape",
              },
              {
                "elementId": "sequence-binding-mermaid-876749da",
                "occurrenceId": "mermaid:092e83e2:participant:bob#1",
                "ordinal": 0,
                "role": "actor-bottom-label",
              },
              {
                "elementId": "actor1",
                "occurrenceId": "mermaid:092e83e2:participant:bob#1",
                "ordinal": 0,
                "role": "lifeline",
              },
              {
                "elementId": "sequence-binding-mermaid-51593bfd",
                "occurrenceId": "mermaid:092e83e2:participant:archive#2",
                "ordinal": 0,
                "role": "actor-shape",
              },
              {
                "elementId": "sequence-binding-mermaid-4a92b252",
                "occurrenceId": "mermaid:092e83e2:participant:archive#2",
                "ordinal": 0,
                "role": "actor-label",
              },
              {
                "elementId": "sequence-binding-mermaid-40ba3815",
                "occurrenceId": "mermaid:092e83e2:participant:archive#2",
                "ordinal": 0,
                "role": "actor-bottom-shape",
              },
              {
                "elementId": "sequence-binding-mermaid-e5a77b5a",
                "occurrenceId": "mermaid:092e83e2:participant:archive#2",
                "ordinal": 0,
                "role": "actor-bottom-label",
              },
              {
                "elementId": "actor2",
                "occurrenceId": "mermaid:092e83e2:participant:archive#2",
                "ordinal": 0,
                "role": "lifeline",
              },
              {
                "elementId": "sequence-binding-mermaid-2fa9645f",
                "occurrenceId": "mermaid:092e83e2:message:alice->>bob:repeat#2",
                "ordinal": 0,
                "role": "message-line",
              },
              {
                "elementId": "sequence-binding-mermaid-1fa8be6b",
                "occurrenceId": "mermaid:092e83e2:message:alice->>bob:repeat#2",
                "ordinal": 0,
                "role": "message-label",
              },
              {
                "elementId": "sequence-binding-mermaid-608b28fd",
                "occurrenceId": "mermaid:092e83e2:message:bob->>bob:inspect#4",
                "ordinal": 0,
                "role": "message-line",
              },
              {
                "elementId": "sequence-binding-mermaid-2b29ae65",
                "occurrenceId": "mermaid:092e83e2:message:bob->>bob:inspect#4",
                "ordinal": 0,
                "role": "message-label",
              },
              {
                "elementId": "sequence-binding-mermaid-97355193",
                "occurrenceId": "mermaid:092e83e2:message:alice->>bob:repeat#6",
                "ordinal": 0,
                "role": "message-line",
              },
              {
                "elementId": "sequence-binding-mermaid-0c90fe77",
                "occurrenceId": "mermaid:092e83e2:message:alice->>bob:repeat#6",
                "ordinal": 0,
                "role": "message-label",
              },
              {
                "elementId": "sequence-binding-mermaid-dca76ef4",
                "occurrenceId": "mermaid:092e83e2:message:bob->>archive:archive#8",
                "ordinal": 0,
                "role": "message-line",
              },
              {
                "elementId": "sequence-binding-mermaid-0c7f71da",
                "occurrenceId": "mermaid:092e83e2:message:bob->>archive:archive#8",
                "ordinal": 0,
                "role": "message-label",
              },
              {
                "elementId": "sequence-binding-mermaid-bc52eb71",
                "occurrenceId": "mermaid:092e83e2:group:loop:outer exchange#0",
                "ordinal": 0,
                "role": "group-frame",
              },
              {
                "elementId": "sequence-binding-mermaid-7854befc",
                "occurrenceId": "mermaid:092e83e2:group:loop:outer exchange#0",
                "ordinal": 1,
                "role": "group-frame",
              },
              {
                "elementId": "sequence-binding-mermaid-784e0337",
                "occurrenceId": "mermaid:092e83e2:group:loop:outer exchange#0",
                "ordinal": 2,
                "role": "group-frame",
              },
              {
                "elementId": "sequence-binding-mermaid-bc50acda",
                "occurrenceId": "mermaid:092e83e2:group:loop:outer exchange#0",
                "ordinal": 3,
                "role": "group-frame",
              },
              {
                "elementId": "sequence-binding-mermaid-89f3563a",
                "occurrenceId": "mermaid:092e83e2:group:loop:outer exchange#0",
                "ordinal": 0,
                "role": "group-label",
              },
              {
                "elementId": "sequence-binding-mermaid-9e90fbd2",
                "occurrenceId": "mermaid:092e83e2:group:alt:nested review#1",
                "ordinal": 0,
                "role": "group-frame",
              },
              {
                "elementId": "sequence-binding-mermaid-9a8eb6ef",
                "occurrenceId": "mermaid:092e83e2:group:alt:nested review#1",
                "ordinal": 1,
                "role": "group-frame",
              },
              {
                "elementId": "sequence-binding-mermaid-9a9705b4",
                "occurrenceId": "mermaid:092e83e2:group:alt:nested review#1",
                "ordinal": 2,
                "role": "group-frame",
              },
              {
                "elementId": "sequence-binding-mermaid-5e9468a9",
                "occurrenceId": "mermaid:092e83e2:group:alt:nested review#1",
                "ordinal": 3,
                "role": "group-frame",
              },
              {
                "elementId": "sequence-binding-mermaid-ff868571",
                "occurrenceId": "mermaid:092e83e2:group:alt:nested review#1",
                "ordinal": 0,
                "role": "group-label",
              },
              {
                "elementId": "sequence-binding-mermaid-9dbe0ad2",
                "occurrenceId": "mermaid:092e83e2:activation:activate:bob#3",
                "ordinal": 0,
                "role": "activation",
              },
              {
                "elementId": "sequence-binding-mermaid-23c60c6d",
                "occurrenceId": "mermaid:092e83e2:note:right of:bob:local note#5",
                "ordinal": 0,
                "role": "note-shape",
              },
              {
                "elementId": "sequence-binding-mermaid-4f008302",
                "occurrenceId": "mermaid:092e83e2:note:right of:bob:local note#5",
                "ordinal": 0,
                "role": "note-label",
              },
            ],
            "language": "mermaid",
            "occurrences": [
              {
                "id": "mermaid:092e83e2:participant:alice#0",
                "kind": "actor",
                "label": "Alice",
                "ordinal": 0,
                "sourceSpan": {
                  "end": 44,
                  "lineEnd": 2,
                  "lineStart": 2,
                  "start": 18,
                },
                "structuralKey": "actor:alice",
              },
              {
                "id": "mermaid:092e83e2:participant:bob#1",
                "kind": "actor",
                "label": "Bob",
                "ordinal": 1,
                "sourceSpan": {
                  "end": 69,
                  "lineEnd": 3,
                  "lineStart": 3,
                  "start": 47,
                },
                "structuralKey": "actor:bob",
              },
              {
                "id": "mermaid:092e83e2:participant:archive#2",
                "kind": "actor",
                "label": "Archive Service Far Right",
                "ordinal": 2,
                "sourceSpan": {
                  "end": 120,
                  "lineEnd": 4,
                  "lineStart": 4,
                  "start": 72,
                },
                "structuralKey": "actor:archive",
              },
              {
                "id": "mermaid:092e83e2:group:loop:outer exchange#0",
                "kind": "group",
                "label": "outer exchange",
                "ordinal": 0,
                "sourceSpan": {
                  "end": 331,
                  "lineEnd": 14,
                  "lineStart": 5,
                  "start": 123,
                },
                "structuralKey": "group:root/loop:outer exchange",
              },
              {
                "id": "mermaid:092e83e2:group:alt:nested review#1",
                "kind": "group",
                "label": "nested review",
                "ordinal": 1,
                "parentId": "mermaid:092e83e2:group:loop:outer exchange#0",
                "sourceSpan": {
                  "end": 325,
                  "lineEnd": 13,
                  "lineStart": 6,
                  "start": 147,
                },
                "structuralKey": "group:group:root/loop:outer exchange/alt:nested review",
              },
              {
                "id": "mermaid:092e83e2:message:alice->>bob:repeat#2",
                "kind": "message",
                "label": "repeat",
                "ordinal": 2,
                "parentId": "mermaid:092e83e2:group:alt:nested review#1",
                "sourceSpan": {
                  "end": 190,
                  "lineEnd": 7,
                  "lineStart": 7,
                  "start": 171,
                },
                "structuralKey": "message:group:group:root/loop:outer exchange/alt:nested review/alice->>bob:repeat",
              },
              {
                "id": "mermaid:092e83e2:activation:activate:bob#3",
                "kind": "activation",
                "label": "activate",
                "ordinal": 3,
                "parentId": "mermaid:092e83e2:group:alt:nested review#1",
                "sourceSpan": {
                  "end": 209,
                  "lineEnd": 8,
                  "lineStart": 8,
                  "start": 197,
                },
                "structuralKey": "activation:group:group:root/loop:outer exchange/alt:nested review/activate:bob",
              },
              {
                "id": "mermaid:092e83e2:message:bob->>bob:inspect#4",
                "kind": "message",
                "label": "inspect",
                "ordinal": 4,
                "parentId": "mermaid:092e83e2:group:alt:nested review#1",
                "sourceSpan": {
                  "end": 234,
                  "lineEnd": 9,
                  "lineStart": 9,
                  "start": 216,
                },
                "structuralKey": "message:group:group:root/loop:outer exchange/alt:nested review/bob->>bob:inspect",
              },
              {
                "id": "mermaid:092e83e2:note:right of:bob:local note#5",
                "kind": "note",
                "label": "local note",
                "ordinal": 5,
                "parentId": "mermaid:092e83e2:group:alt:nested review#1",
                "sourceSpan": {
                  "end": 270,
                  "lineEnd": 10,
                  "lineStart": 10,
                  "start": 241,
                },
                "structuralKey": "note:group:group:root/loop:outer exchange/alt:nested review/right of:bob:local note",
              },
              {
                "id": "mermaid:092e83e2:message:alice->>bob:repeat#6",
                "kind": "message",
                "label": "repeat",
                "ordinal": 6,
                "parentId": "mermaid:092e83e2:group:alt:nested review#1",
                "sourceSpan": {
                  "end": 296,
                  "lineEnd": 11,
                  "lineStart": 11,
                  "start": 277,
                },
                "structuralKey": "message:group:group:root/loop:outer exchange/alt:nested review/alice->>bob:repeat",
              },
              {
                "id": "mermaid:092e83e2:message:bob->>archive:archive#8",
                "kind": "message",
                "label": "archive",
                "ordinal": 8,
                "sourceSpan": {
                  "end": 356,
                  "lineEnd": 15,
                  "lineStart": 15,
                  "start": 334,
                },
                "structuralKey": "message:root/bob->>archive:archive",
              },
            ],
            "protocol": "grapht-sequence/0",
            "relations": [
              {
                "id": "mermaid:092e83e2:relation:0",
                "kind": "contains",
                "ordinal": 0,
                "sourceId": "mermaid:092e83e2:group:loop:outer exchange#0",
                "targetId": "mermaid:092e83e2:group:alt:nested review#1",
              },
              {
                "id": "mermaid:092e83e2:relation:1",
                "kind": "contains",
                "ordinal": 1,
                "sourceId": "mermaid:092e83e2:group:alt:nested review#1",
                "targetId": "mermaid:092e83e2:message:alice->>bob:repeat#2",
              },
              {
                "id": "mermaid:092e83e2:relation:2",
                "kind": "message",
                "occurrenceId": "mermaid:092e83e2:message:alice->>bob:repeat#2",
                "ordinal": 2,
                "sourceId": "mermaid:092e83e2:participant:alice#0",
                "targetId": "mermaid:092e83e2:participant:bob#1",
              },
              {
                "id": "mermaid:092e83e2:relation:3",
                "kind": "contains",
                "ordinal": 3,
                "sourceId": "mermaid:092e83e2:group:alt:nested review#1",
                "targetId": "mermaid:092e83e2:activation:activate:bob#3",
              },
              {
                "id": "mermaid:092e83e2:relation:4",
                "kind": "activates",
                "occurrenceId": "mermaid:092e83e2:activation:activate:bob#3",
                "ordinal": 4,
                "sourceId": "mermaid:092e83e2:activation:activate:bob#3",
                "targetId": "mermaid:092e83e2:participant:bob#1",
              },
              {
                "id": "mermaid:092e83e2:relation:5",
                "kind": "contains",
                "ordinal": 5,
                "sourceId": "mermaid:092e83e2:group:alt:nested review#1",
                "targetId": "mermaid:092e83e2:message:bob->>bob:inspect#4",
              },
              {
                "id": "mermaid:092e83e2:relation:6",
                "kind": "message",
                "occurrenceId": "mermaid:092e83e2:message:bob->>bob:inspect#4",
                "ordinal": 6,
                "sourceId": "mermaid:092e83e2:participant:bob#1",
                "targetId": "mermaid:092e83e2:participant:bob#1",
              },
              {
                "id": "mermaid:092e83e2:relation:7",
                "kind": "contains",
                "ordinal": 7,
                "sourceId": "mermaid:092e83e2:group:alt:nested review#1",
                "targetId": "mermaid:092e83e2:note:right of:bob:local note#5",
              },
              {
                "id": "mermaid:092e83e2:relation:8",
                "kind": "contains",
                "ordinal": 8,
                "sourceId": "mermaid:092e83e2:group:alt:nested review#1",
                "targetId": "mermaid:092e83e2:message:alice->>bob:repeat#6",
              },
              {
                "id": "mermaid:092e83e2:relation:9",
                "kind": "message",
                "occurrenceId": "mermaid:092e83e2:message:alice->>bob:repeat#6",
                "ordinal": 9,
                "sourceId": "mermaid:092e83e2:participant:alice#0",
                "targetId": "mermaid:092e83e2:participant:bob#1",
              },
              {
                "id": "mermaid:092e83e2:relation:12",
                "kind": "message",
                "occurrenceId": "mermaid:092e83e2:message:bob->>archive:archive#8",
                "ordinal": 12,
                "sourceId": "mermaid:092e83e2:participant:bob#1",
                "targetId": "mermaid:092e83e2:participant:archive#2",
              },
            ],
            "renderRevision": {
              "id": "render:fa11e65f",
              "rendererOptionsHash": "cab16f83",
              "rendererPackage": "mermaid",
              "rendererVersion": "11.16.0",
              "sourceRevisionId": "source:10b3b203",
            },
            "sourceRevision": {
              "adapterVersion": "mermaid-sequence-adapter/0",
              "id": "source:10b3b203",
              "locator": "fixtures/sequence/0_mermaid.mmd",
              "sourceHash": "ccb5e407",
            },
          },
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
