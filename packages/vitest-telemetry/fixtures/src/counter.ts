import type { Bus } from './cqrs'
import { Logger } from '../../src/index'
const log = Logger(import.meta.url)
export function mountCounter(root: HTMLElement, bus: Bus) {
  root.innerHTML = `<button id="inc">inc</button><output id="out">0</output>`
  const out = root.querySelector<HTMLOutputElement>('#out')!
  root.querySelector('#inc')!.addEventListener('click', async () => {
    await bus.dispatch({ type: 'increment', payload: 1 })
    out.value = String(await bus.ask<number>({ type: 'count' }))
    log.info('render count={count}', { count: out.value })
  })
}
