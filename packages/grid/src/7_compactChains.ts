// JetBrains-style compact-middle-packages: collapse a run of single-child, non-payload rows into
// one display row. Pure data transform over TData[]; the caller decides row shape via `combine`.
export type CompactChainsOptions<TData> = {
  getSubRows: (row: TData) => TData[] | undefined
  // A row with no children is a payload row by default: the chain always stops at a leaf.
  isLeafPayload?: (row: TData) => boolean
  // chain: the run being merged (length 1 when nothing compacted). children: already-compacted.
  combine: (chain: TData[], children: TData[]) => TData
}

function compactNode<TData>(node: TData, options: Required<Pick<CompactChainsOptions<TData>, "getSubRows" | "isLeafPayload">> & CompactChainsOptions<TData>): TData {
  const { getSubRows, isLeafPayload, combine } = options
  const chain: TData[] = [node]
  let current = node
  while (!isLeafPayload(current)) {
    const kids = getSubRows(current) ?? []
    if (kids.length !== 1) break
    current = kids[0] as TData
    chain.push(current)
  }
  const tailKids = getSubRows(current) ?? []
  const children = tailKids.map((kid) => compactNode(kid, options))
  return combine(chain, children)
}

export function compactSingleChildChains<TData>(roots: TData[], options: CompactChainsOptions<TData>): TData[] {
  const isLeafPayload = options.isLeafPayload ?? ((row: TData) => !(options.getSubRows(row)?.length))
  const resolved = { ...options, isLeafPayload }
  return roots.map((root) => compactNode(root, resolved))
}
