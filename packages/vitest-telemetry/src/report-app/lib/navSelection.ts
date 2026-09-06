// First leaf / first failing test over the nav tree. `Selection` is duplicated from model.ts
// (not imported: avoids a lib -> model cycle, same trade-off as lib/verdicts.ts's split).
import type { NavNode } from '../adapter/navTree.js'

export type Selection = { file: string | null; test: string | null }

export function findFirstLeaf(nodes: NavNode[]): Selection | null {
  for (const node of nodes) {
    if (node.kind === 'test') return { file: node.file!, test: node.test ?? null }
    if (node.children) {
      const found = findFirstLeaf(node.children)
      if (found) return found
    }
  }
  return null
}

export function findFirstFailure(nodes: NavNode[]): Selection | null {
  for (const node of nodes) {
    if (node.kind === 'test' && node.status === 'fail') return { file: node.file!, test: node.test ?? null }
    if (node.children) {
      const found = findFirstFailure(node.children)
      if (found) return found
    }
  }
  return null
}
