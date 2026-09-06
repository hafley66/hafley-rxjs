// Where does time go: slow fixture vs slow beforeEach vs body. Read spans test.beforeEach / test.callback / body.
import { beforeEach, expect, test as base } from 'vitest'
import { trace } from '@opentelemetry/api'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const test = base.extend<{ slowFixture: string }>({
  slowFixture: async ({}, use) => { await sleep(300); await use('ready'); await sleep(50) },
})
beforeEach(async () => { await sleep(200) })

test('body is fast, setup is slow', async ({ slowFixture }) => {
  await trace.getTracer('lab.test').startActiveSpan('body', async (s) => { await sleep(10); s.end() })
  expect(slowFixture).toBe('ready')
})
