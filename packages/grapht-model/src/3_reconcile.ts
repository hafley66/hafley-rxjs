import type { BoardPlacement, GeometrySnapshot, ReconciliationInput, ReconciliationResult } from "./0_types.js"

export function reconcilePlacements(input: ReconciliationInput): ReconciliationResult {
  const previousPlacements = new Map((input.previous?.placements ?? []).map((placement) => [placement.entityId, placement]))
  const nextGeometry = new Map(input.next.geometry.entities.map((entity) => [entity.entityId, entity]))
  const retained: string[] = []
  const inserted: string[] = []
  const removed: string[] = []
  const placements: BoardPlacement[] = []

  for (const [entityId, placement] of previousPlacements) {
    if (nextGeometry.has(entityId)) {
      retained.push(entityId)
      placements.push({ ...placement, baseGeometryRevisionId: input.next.geometry.id })
    } else {
      removed.push(entityId)
    }
  }

  for (const entity of input.next.geometry.entities) {
    if (previousPlacements.has(entity.entityId)) continue
    inserted.push(entity.entityId)
    placements.push({
      viewId: input.previous?.placements[0]?.viewId ?? "default",
      entityId: entity.entityId,
      baseGeometryRevisionId: input.next.geometry.id,
      rect: entity.worldBounds,
      source: "auto-layout",
      policy: "delta-from-layout",
    })
  }

  return { retained, inserted, removed, ambiguous: [], placements }
}

export function placementForEntity(placements: BoardPlacement[], entityId: string): BoardPlacement | undefined {
  return placements.find((placement) => placement.entityId === entityId)
}

export function geometryBounds(geometry: GeometrySnapshot) {
  return geometry.viewBox
}
