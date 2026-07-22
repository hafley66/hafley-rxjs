import { describe, expect, it } from 'vitest'
import { AutomationJsonSchema, AutomationSchema } from './1_schema'

const source = 'jsonrx://test/source'
const base = {
  version: 'automation.v1',
  profile: 'rxjs-7.8',
  id: 'jsonrx://test/automation',
  bindings: { sources: { [source]: { kind: 'host.event', operation: 'test/read' } } },
  circuit: { sources: { [source]: {} }, reducers: {}, flows: {} },
  outputs: [{ kind: 'host.emit', flow: 'jsonrx://test/flow', stream: 'test', schema: { type: 'object' } }],
} as const

describe('automation schema', () => {
  it('accepts the preferred pipe form', () => {
    const parsed = AutomationSchema.parse({ ...base, circuit: { ...base.circuit, flows: { 'jsonrx://test/flow': { pipe: [
      { node: 'source', source: { $ref: source } },
      { node: 'share', shareReplay: { bufferSize: 1, refCount: true } },
    ] } } } })
    expect({ documentSchema: parsed.$schema, version: parsed.version, pipe: parsed.circuit.flows['jsonrx://test/flow'].pipe, schema: AutomationJsonSchema.$schema }).toMatchInlineSnapshot(`
      {
        "documentSchema": "./node_modules/@hafley66/json-rx/automation.schema.json",
        "pipe": [
          {
            "node": "source",
            "source": {
              "$ref": "jsonrx://test/source",
            },
          },
          {
            "node": "share",
            "shareReplay": {
              "bufferSize": 1,
              "refCount": true,
            },
          },
        ],
        "schema": "https://json-schema.org/draft/2020-12/schema",
        "version": "automation.v1",
      }
    `)
  })

  it('accepts nested expressions for compatibility', () => {
    const parsed = AutomationSchema.parse({ ...base, circuit: { ...base.circuit, flows: { 'jsonrx://test/flow': { expression: {
      node: 'share', shareReplay: { bufferSize: 1, refCount: true, input: { node: 'source', source: { $ref: source } } },
    } } } } })
    expect(parsed.circuit.flows['jsonrx://test/flow'].expression).toMatchInlineSnapshot(`
      {
        "node": "share",
        "shareReplay": {
          "bufferSize": 1,
          "input": {
            "node": "source",
            "source": {
              "$ref": "jsonrx://test/source",
            },
          },
          "refCount": true,
        },
      }
    `)
  })
})
