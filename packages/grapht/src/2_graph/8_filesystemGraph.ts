import type { Graph } from "@hafley66/grapht-model"

export type FilesystemEntry = {
  path: string
  name: string
  isDirectory: boolean
}

export type FilesystemNodeData = {
  kind: "directory" | "file"
  name: string
  path: string
}

export type FilesystemGraph = Graph<FilesystemNodeData, never>

function parentPath(path: string): string | undefined {
  const separator = path.lastIndexOf("/")
  if (separator <= 0) return undefined
  return path.slice(0, separator)
}

export function filesystemGraph(entries: readonly FilesystemEntry[]): FilesystemGraph {
  const paths = new Set(entries.map(entry => entry.path))
  const graph: Record<string, FilesystemGraph[string]> = {}

  for (const entry of entries) {
    const parentId = parentPath(entry.path)
    graph[entry.path] = {
      id: entry.path,
      type: "node",
      ...(parentId !== undefined && paths.has(parentId) ? { parentId } : {}),
      data: {
        kind: entry.isDirectory ? "directory" : "file",
        name: entry.name,
        path: entry.path,
      },
    }
  }

  return graph
}
