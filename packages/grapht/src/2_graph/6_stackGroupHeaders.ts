import { ancestorsOf, type Graph, type GraphId } from "@hafley66/grapht-model"
import type { GraphCamera, HeaderPlacement } from "./0_frame.js"

export type GroupHeader = {
  id: GraphId
  naturalTop: number
  boundaryBottom: number
  height: number
  order: number
}

export type StackGroupHeadersInput = {
  graph: Graph
  headers: readonly GroupHeader[]
  camera: GraphCamera
  inset: number
  gap: number
}

type HeaderMeta = {
  header: GroupHeader
  depth: number
  parentHeaderId?: GraphId
}

function byOrder(left: HeaderMeta, right: HeaderMeta): number {
  return (
    left.header.order - right.header.order ||
    left.header.naturalTop - right.header.naturalTop ||
    left.header.id.localeCompare(right.header.id)
  )
}

export function stackGroupHeaders(input: StackGroupHeadersInput): readonly HeaderPlacement[] {
  const { graph, headers, camera, inset, gap } = input
  const headerIds = new Set(headers.map(header => header.id))
  const headersByParent = new Map<GraphId | undefined, HeaderMeta[]>()
  const metas = headers.map(header => {
    const headerAncestors = ancestorsOf(graph, header.id).filter(ancestor => headerIds.has(ancestor))
    const meta: HeaderMeta = {
      header,
      depth: headerAncestors.length,
      ...(headerAncestors[0] === undefined ? {} : { parentHeaderId: headerAncestors[0] }),
    }
    const family = headersByParent.get(meta.parentHeaderId)
    if (family) family.push(meta)
    else headersByParent.set(meta.parentHeaderId, [meta])
    return meta
  })
  const placements = new Map<GraphId, HeaderPlacement>()

  const placeFamily = (parentHeaderId: GraphId | undefined): void => {
    const family = headersByParent.get(parentHeaderId)
    if (!family) return

    const parent = parentHeaderId === undefined ? undefined : placements.get(parentHeaderId)
    const parentHeader = parentHeaderId === undefined ? undefined : metas.find(meta => meta.header.id === parentHeaderId)?.header
    const slot =
      parent === undefined
        ? camera.viewport.y + inset
        : parent.state === "stuck" && parentHeader !== undefined
          ? parent.top + parentHeader.height * camera.scale + gap
          : undefined
    const active =
      slot === undefined
        ? undefined
        : [...family]
            .filter(meta => {
              const naturalTop = meta.header.naturalTop * camera.scale + camera.y
              const boundaryBottom = meta.header.boundaryBottom * camera.scale + camera.y
              return naturalTop <= slot && boundaryBottom > slot
            })
            .sort(byOrder)
            .at(-1)?.header.id

    for (const meta of [...family].sort(byOrder)) {
      const naturalTop = meta.header.naturalTop * camera.scale + camera.y
      const boundaryBottom = meta.header.boundaryBottom * camera.scale + camera.y
      const visible = parent?.visible === false ? false : boundaryBottom > (slot ?? inset)
      const stuck = visible && active === meta.header.id
      const replaced = visible && slot !== undefined && naturalTop <= slot && !stuck
      placements.set(meta.header.id, {
        id: meta.header.id,
        depth: meta.depth,
        top: stuck ? slot ?? naturalTop : naturalTop,
        visible: visible && !replaced,
        state: stuck ? "stuck" : visible && !replaced ? "natural" : "released",
      })
    }

    for (const meta of [...family].sort(byOrder)) placeFamily(meta.header.id)
  }

  placeFamily(undefined)

  return metas
    .sort((left, right) => left.depth - right.depth || byOrder(left, right))
    .map(meta => placements.get(meta.header.id) as HeaderPlacement)
}
