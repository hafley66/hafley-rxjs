// Pure filter behind Header's "failed only" checkbox: keep failing tests plus every ancestor on
// their path to a root, drop everything else.
import type { NavNode } from '../adapter/navTree.js'

function keep(node: NavNode): NavNode | null {
  const children = node.children?.map(keep).filter((n): n is NavNode => n !== null)
  if (children && children.length) return { ...node, children }
  if (node.kind === 'test' && node.status === 'fail') return { ...node, children: node.children }
  return null
}

export function filterFailedOnly(nodes: NavNode[]): NavNode[] {
  return nodes.map(keep).filter((n): n is NavNode => n !== null)
}
