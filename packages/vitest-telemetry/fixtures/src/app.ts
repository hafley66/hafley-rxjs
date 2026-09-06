import { configure, getConsoleSink } from '@logtape/logtape'
import { makeBus } from './cqrs'
import { mountCounter } from './counter'
await configure({ sinks: { console: getConsoleSink() }, loggers: [{ category: 'lab', lowestLevel: 'debug', sinks: ['console'] }] })
mountCounter(document.getElementById('root')!, makeBus())
