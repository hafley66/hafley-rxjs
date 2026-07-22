import { compile, NodeHost } from '@typespec/compiler'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const experiment = (name: string) => resolve(import.meta.dirname, `../../experiments/0_typesystem/${name}`)
const diagnostics = async (name: string) => {
  const program = await compile(NodeHost, experiment(name), { noEmit: true })
  return program.diagnostics.map(({ code, message, severity }) => ({ code, message, severity }))
}

describe('TypeSpec Rx type-flow experiments', () => {
  test('compiles the fixed-arity algebra, typed graph, operator catalog, and function inference', async () => {
    expect({
      algebra: await diagnostics('0_rx_algebra.tsp'),
      graph: await diagnostics('1_graph_wiring.tsp'),
      functionInference: await diagnostics('4_inference_functions.tsp'),
      operatorCatalog: await diagnostics('5_operator_catalog.tsp'),
      aliasPipeline: (await diagnostics('6_alias_pipeline.tsp')).map(({ code }) => code),
      aliasPipelineAssertions: (await diagnostics('7_alias_pipeline_assertions.tsp')).map(({ code }) => code),
      observableConstructor: (await diagnostics('8_observable_constructor.tsp')).map(({ code }) => code),
    }).toMatchInlineSnapshot(`
      {
        "algebra": [],
        "aliasPipeline": [
          "experimental-feature",
          "experimental-feature",
          "experimental-feature",
          "experimental-feature",
          "experimental-feature",
        ],
        "aliasPipelineAssertions": [
          "experimental-feature",
          "experimental-feature",
          "experimental-feature",
          "experimental-feature",
          "experimental-feature",
        ],
        "functionInference": [
          {
            "code": "experimental-feature",
            "message": "Function declarations are an experimental feature that may change in the future. Use with caution and consider providing feedback to the TypeSpec team.",
            "severity": "warning",
          },
        ],
        "graph": [],
        "observableConstructor": [
          "experimental-feature",
          "experimental-feature",
          "experimental-feature",
          "experimental-feature",
        ],
        "operatorCatalog": [],
      }
    `)
  })

  test('rejects an incompatible stream edge', async () => {
    expect(await diagnostics('2_invalid_graph_wiring.tsp')).toMatchInlineSnapshot(`
      [
        {
          "code": "unassignable",
          "message": "Type 'JsonRxExperiment.Stream<JsonRxExperiment.Tick>' is not assignable to type 'JsonRxExperiment.Stream<JsonRxExperiment.Click>'
        Types of property 'value' are incompatible
          Type 'JsonRxExperiment.Tick' is not assignable to type 'JsonRxExperiment.Click'
            Property 'x' is missing on type 'JsonRxExperiment.Tick' but required in 'JsonRxExperiment.Click'",
          "severity": "error",
        },
      ]
    `)
  })

  test('closes a host flow over a reusable signal expression', async () => {
    const module = await import(new URL('../../experiments/0_typesystem/8_observable_constructor.js', import.meta.url).href) as {
      graphs: WeakMap<object, Array<{ kind: string; inputs: unknown[]; config: unknown }>>
    }
    const program = await compile(NodeHost, experiment('8_observable_constructor.tsp'), { noEmit: true })
    const graph = module.graphs.get(program)?.map(({ kind, inputs, config }) => ({ kind, inputCount: inputs.length, config }))

    expect({ diagnostics: program.diagnostics.map(({ code }) => code), graph }).toMatchInlineSnapshot(`
      {
        "diagnostics": [
          "experimental-feature",
          "experimental-feature",
          "experimental-feature",
          "experimental-feature",
        ],
        "graph": [
          {
            "config": {
              "address": "account/rateLimits/read",
            },
            "inputCount": 0,
            "kind": "host",
          },
          {
            "config": {
              "logic": {
                "remaining": "limit - usage",
              },
            },
            "inputCount": 1,
            "kind": "signal",
          },
          {
            "config": {
              "stream": "codex.remaining",
            },
            "inputCount": 1,
            "kind": "emit",
          },
        ],
      }
    `)
  })
})
