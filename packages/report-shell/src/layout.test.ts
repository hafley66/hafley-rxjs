// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { of } from 'rxjs'
import { layout, type Track } from './layout'

const TRACKS: Track[] = [{ name: 'nav', min: 100, max: 500, fallback: 300, axis: 'x' }]
const memory = () => {
  const writes: string[] = []
  return { storage: { read: of(''), write: { next: (v: string) => writes.push(v), error() {}, complete() {} } }, writes }
}

describe('layout', () => {
  it('writes the CSS var and storage on change, and stops after unsubscribe', () => {
    const { storage, writes } = memory()
    const root = document.createElement('div')
    const shell = layout(root, TRACKS, storage)
    expect(root.style.getPropertyValue('--track-nav')).toBe('300px')

    shell.tracks.nav!.$(420)
    expect(root.style.getPropertyValue('--track-nav')).toBe('420px')
    const writesBefore = writes.length

    shell.unsubscribe()
    shell.tracks.nav!.$(150)
    expect(root.style.getPropertyValue('--track-nav')).toBe('420px')
    expect(writes.length).toBe(writesBefore)
  })
})
