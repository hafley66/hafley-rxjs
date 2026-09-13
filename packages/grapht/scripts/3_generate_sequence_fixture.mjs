import { readFile, writeFile } from "node:fs/promises"
import { register } from "node:module"

const resolveHook = `export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && !/\\.[a-z0-9]+$/i.test(specifier) && !specifier.endsWith("/")) {
    try { return await nextResolve(specifier + ".js", context) } catch { return nextResolve(specifier, context) }
  }
  return nextResolve(specifier, context)
}`
register("data:text/javascript," + encodeURIComponent(resolveHook))

const { buildSequenceArtifact, decorateSvg, measureSequenceSvg } = await import("@hafley66/grapht")
const { sequenceDocumentToGraph } = await import("@hafley66/grapht-model")
const { mermaidSequenceAdapter } = await import("@hafley66/mmd")

const fixtureDir = new URL("../fixtures/sequence/", import.meta.url)
const sourceUrl = new URL("large.mmd", fixtureDir)
const svgUrl = new URL("large.svg", fixtureDir)
const jsonUrl = new URL("large.json", fixtureDir)
const sourceLocator = "fixtures/sequence/large.mmd"

const round = value => Math.round(value * 100) / 100

const source = await readFile(sourceUrl, "utf8")
const { artifact, bindingReceipt, renderReceipt } = await buildSequenceArtifact(mermaidSequenceAdapter, {
  locator: sourceLocator,
  source,
})
const geometry = await measureSequenceSvg(artifact, bindingReceipt, renderReceipt)

const occurrencesById = new Map(artifact.occurrences.map(occurrence => [occurrence.id, occurrence]))
const entitiesByRole = new Map()
for (const entity of geometry.entities) {
  const group = entitiesByRole.get(entity.role) ?? []
  group.push(entity)
  entitiesByRole.set(entity.role, group)
}

const viewBox = geometry.viewBox
const viewBoxBottom = viewBox.y + viewBox.height

const actors = (entitiesByRole.get("actor-shape") ?? []).map(entity => {
  const occurrence = occurrencesById.get(entity.occurrenceId)
  const lifeline = (entitiesByRole.get("lifeline") ?? []).find(item => item.occurrenceId === entity.occurrenceId)
  const top = entity.worldBounds.y
  const bottom = lifeline ? lifeline.worldBounds.y + lifeline.worldBounds.height : viewBoxBottom
  return {
    id: entity.occurrenceId,
    label: occurrence?.label ?? "",
    left: round(entity.worldBounds.x),
    width: round(entity.worldBounds.width),
    top: round(top),
    bottom: round(bottom),
    elementId: entity.elementId,
  }
}).sort((a, b) => a.left - b.left)

const frameEntitiesByOccurrence = new Map()
for (const entity of entitiesByRole.get("group-frame") ?? []) {
  const group = frameEntitiesByOccurrence.get(entity.occurrenceId) ?? []
  group.push(entity)
  frameEntitiesByOccurrence.set(entity.occurrenceId, group)
}

const unionBounds = entities => {
  const left = Math.min(...entities.map(entity => entity.worldBounds.x))
  const top = Math.min(...entities.map(entity => entity.worldBounds.y))
  const right = Math.max(...entities.map(entity => entity.worldBounds.x + entity.worldBounds.width))
  const bottom = Math.max(...entities.map(entity => entity.worldBounds.y + entity.worldBounds.height))
  return { left, top, right, bottom }
}

const groupRects = new Map()
for (const [occurrenceId, entities] of frameEntitiesByOccurrence) {
  groupRects.set(occurrenceId, unionBounds(entities))
}

const contains = (outer, inner) =>
  outer.left < inner.left - 0.5 &&
  outer.right > inner.right + 0.5 &&
  outer.top < inner.top - 0.5 &&
  outer.bottom > inner.bottom + 0.5

const groups = [...groupRects.entries()].map(([occurrenceId, rect]) => {
  const occurrence = occurrencesById.get(occurrenceId)
  const depth = [...groupRects.entries()].filter(
    ([otherId, otherRect]) => otherId !== occurrenceId && contains(otherRect, rect),
  ).length
  return {
    id: occurrenceId,
    label: occurrence?.label ?? "",
    left: round(rect.left),
    width: round(rect.right - rect.left),
    top: round(rect.top),
    bottom: round(rect.bottom),
    depth,
    elementId: frameEntitiesByOccurrence.get(occurrenceId)?.[0]?.elementId ?? "",
  }
})

const messageCount = artifact.occurrences.filter(occurrence => occurrence.kind === "message").length

const json = {
  schema: 2,
  graph: sequenceDocumentToGraph(artifact),
  bindings: bindingReceipt.bindings.map(({ elementId, occurrenceId, role, ordinal }) => ({ elementId, graphId: occurrenceId, role, ordinal })),
  source: sourceLocator,
  viewBox: {
    x: round(viewBox.x),
    y: round(viewBox.y),
    width: round(viewBox.width),
    height: round(viewBox.height),
  },
  actors,
  groups,
  counts: {
    participants: actors.length,
    messages: messageCount,
    groups: groups.length,
  },
}

const decorated = decorateSvg(renderReceipt, bindingReceipt)
await writeFile(svgUrl, decorated, "utf8")
const serialized = JSON.stringify(json, (_key, value) => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
  }
  return value
})
await writeFile(jsonUrl, `${serialized}\n`, "utf8")

process.stdout.write(
  `sequence fixture: ${actors.length} actors, ${messageCount} messages, ${groups.length} groups\n`,
)
