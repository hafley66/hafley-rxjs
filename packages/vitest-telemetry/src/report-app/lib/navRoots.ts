// Ancestry rows above the outermost process that owns events (the tmux/bash/node chain the `ps`
// walk found) are noise in a test report: drop each root's synthetic single-child prefix.
export type RootLike = { events: number; children?: RootLike[] }

export function trimSyntheticRoots<T extends RootLike>(roots: T[], isSynthetic: (node: T) => boolean): T[] {
  return roots.map((root) => {
    let node = root
    while (isSynthetic(node) && node.events === 0 && node.children?.length === 1) node = node.children[0] as T
    return node
  })
}
