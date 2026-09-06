import { describe, expect, it } from 'vitest'
import { trimSyntheticRoots } from './navRoots'

type N = { id: string; events: number; synthetic?: boolean; children?: N[] }
const n = (id: string, events: number, synthetic: boolean, children?: N[]): N => ({ id, events, synthetic, children })

describe('trimSyntheticRoots', () => {
  it('drops a synthetic single-child chain down to the first process with events', () => {
    const tree = [n('tmux', 0, true, [n('bash', 0, true, [n('vitest', 4, false, [n('fork', 2, false)])])])]
    expect(trimSyntheticRoots(tree, (x) => !!x.synthetic).map((x) => x.id)).toEqual(['vitest'])
  })

  it('stops at a synthetic node with two children', () => {
    const tree = [n('sh', 0, true, [n('a', 1, false), n('b', 1, false)])]
    expect(trimSyntheticRoots(tree, (x) => !!x.synthetic).map((x) => x.id)).toEqual(['sh'])
  })

  it('leaves a real root alone', () => {
    const tree = [n('vitest', 3, false, [n('x', 1, false)])]
    expect(trimSyntheticRoots(tree, (x) => !!x.synthetic).map((x) => x.id)).toEqual(['vitest'])
  })
})
