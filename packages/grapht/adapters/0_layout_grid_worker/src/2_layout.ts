export type LayoutParameters = { spacing: number; margin: number; columns?: number }

export function parseLayoutParameters(parameters: Record<string, string | number | boolean>): LayoutParameters {
  const numberParameter = (name: string, fallback: number): number => {
    const value = parameters[name]
    if (value === undefined) return fallback
    const parsed = typeof value === "number" ? value : Number(value)
    if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`parameter ${name} must be a finite non-negative number`)
    return parsed
  }
  const columns = parameters.columns === undefined ? undefined : numberParameter("columns", 0)
  return { spacing: numberParameter("spacing", 100), margin: numberParameter("margin", 0), columns: columns === 0 ? undefined : columns }
}

export function degreeOf(nodeCount: number, edges: Array<[number, number]>): Int32Array {
  const degree = new Int32Array(nodeCount)
  edges.forEach(([source, target]) => { degree[source]++; degree[target]++ })
  return degree
}

export function layoutGrid(nodeCount: number, edges: Array<[number, number]>, parameters: LayoutParameters): Float32Array {
  const positions = new Float32Array(nodeCount * 2)
  if (nodeCount === 0) return positions
  const degree = degreeOf(nodeCount, edges)
  const order = Array.from({ length: nodeCount }, (_, index) => index)
  order.sort((a, b) => degree[b] - degree[a] || a - b)
  const columns = parameters.columns && parameters.columns > 0 ? Math.floor(parameters.columns) : Math.ceil(Math.sqrt(nodeCount))
  order.forEach((node, rank) => {
    positions[node * 2] = parameters.margin + (rank % columns) * parameters.spacing
    positions[node * 2 + 1] = parameters.margin + Math.floor(rank / columns) * parameters.spacing
  })
  return positions
}
