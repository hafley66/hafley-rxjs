import { trace } from '@opentelemetry/api'
import { Logger } from '../../src/index'
const log = Logger(import.meta.url)
const tracer = trace.getTracer('lab.cqrs')

export type Command = { type: string; payload?: unknown }
export type Query = { type: string; params?: unknown }
type Handler<I, O> = (input: I, state: State) => O | Promise<O>
export type State = { count: number; events: string[] }

export class Bus {
  state: State = { count: 0, events: [] }
  #commands = new Map<string, Handler<Command, void>>()
  #queries = new Map<string, Handler<Query, unknown>>()
  command(type: string, h: Handler<Command, void>) { this.#commands.set(type, h); return this }
  query(type: string, h: Handler<Query, unknown>) { this.#queries.set(type, h); return this }
  async dispatch(cmd: Command) {
    return tracer.startActiveSpan(`cqrs.command ${cmd.type}`, async (span) => {
      log.info('command {type} {payload}', { type: cmd.type, payload: cmd.payload })
      try {
        const h = this.#commands.get(cmd.type)
        if (!h) throw new Error(`no handler for command ${cmd.type}`)
        await h(cmd, this.state)
        this.state.events.push(cmd.type)
        span.setAttribute('cqrs.events', this.state.events.length)
      } catch (e) {
        log.error('command {type} failed: {error}', { type: cmd.type, error: e })
        span.recordException(e as Error); span.setStatus({ code: 2 })
        throw e
      } finally { span.end() }
    })
  }
  async ask<T>(q: Query): Promise<T> {
    return tracer.startActiveSpan(`cqrs.query ${q.type}`, async (span) => {
      log.debug('query {type}', { type: q.type })
      try { return (await this.#queries.get(q.type)!(q, this.state)) as T } finally { span.end() }
    })
  }
}
export const makeBus = () => new Bus()
  .command('increment', (c, s) => { s.count += Number(c.payload ?? 1) })
  .command('explode', () => { throw new Error('handler exploded') })
  .query('count', (_, s) => s.count)
