// Ancestor node ids that must be expanded to reveal one file/test leaf; feeds the nav grid's
// initial `expanded` state for the default view (open only the failing branch).
import type { NavNode } from '../adapter/navTree.js'

export type Selection = { file: string | null; test: string | null }

function matches(node: NavNode, selection: Selection): boolean {
  if (node.kind === 'test') return node.file === selection.file && node.test === selection.test
  if (node.kind === 'file') return node.file === selection.file && !selection.test
  return false
}

// Ancestor ids from immediate parent up to the root, or null when the tree has no match
// (falls back to the caller's own "expand everything" default).
export function expandedPathTo(nodes: NavNode[], selection: Selection): Record<string, true> | null {
  if (!selection.file) return null
  const path: string[] = []
  const walk = (level: NavNode[]): boolean => {
    for (const node of level) {
      if (matches(node, selection)) return true
      if (node.children && walk(node.children)) {
        path.push(node.id)
        return true
      }
    }
    return false
  }
  if (!walk(nodes)) return null
  const expanded: Record<string, true> = {}
  for (const id of path) expanded[id] = true
  return expanded
}
