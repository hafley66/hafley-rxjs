import { navigateProgram, type Interface, type Operation, type Program } from '@typespec/compiler'
import type { Automation } from '../1_schema'
import { automationKey, flowKey, outputKey, sourceKey, type AutomationMetadata, type FlowMetadata, type OutputMetadata, type SourceMetadata } from './1_decorators'
import { aliasAutomationGraphs } from './4a_aliasFunctions'

export type JsonRxSymbolKind = 'source' | 'flow' | 'output'
export type JsonRxSymbol = { kind: JsonRxSymbolKind; address: string; title: string }
export type JsonRxGraph = {
  automation: AutomationMetadata
  symbols: Map<string, JsonRxSymbol>
  sources: SourceMetadata[]
  flows: FlowMetadata[]
  outputs: OutputMetadata[]
}

export function collectJsonRxGraph(program: Program): JsonRxGraph {
  const aliasGraph = aliasAutomationGraphs.get(program)
  if (aliasGraph?.automation.id) {
    const symbols = new Map<string, JsonRxSymbol>()
    for (const source of aliasGraph.sources) symbols.set(source.id, { kind: 'source', address: source.id, title: source.id })
    for (const flow of aliasGraph.flows) symbols.set(flow.id, { kind: 'flow', address: flow.id, title: flow.id })
    for (const output of aliasGraph.outputs) symbols.set(output.stream, { kind: 'output', address: output.stream, title: output.stream })
    return { ...aliasGraph, symbols }
  }
  const automations: AutomationMetadata[] = []
  const sources: SourceMetadata[] = []
  const flows: FlowMetadata[] = []
  const outputs: OutputMetadata[] = []
  const symbols = new Map<string, JsonRxSymbol>()
  const insert = (kind: JsonRxSymbolKind, address: string, title: string) => {
    if (symbols.has(address)) throw new Error(`Duplicate JSON-RX address: ${address}`)
    symbols.set(address, { kind, address, title })
  }
  navigateProgram(program, {
    interface: (target: Interface) => {
      const metadata = program.stateMap(automationKey).get(target) as AutomationMetadata | undefined
      if (metadata) automations.push(metadata)
    },
    operation: (target: Operation) => {
      const source = program.stateMap(sourceKey).get(target) as SourceMetadata | undefined
      const flow = program.stateMap(flowKey).get(target) as FlowMetadata | undefined
      const output = program.stateMap(outputKey).get(target) as OutputMetadata | undefined
      if (source) { sources.push(source); insert('source', source.id, target.name) }
      if (flow) { flows.push(flow); insert('flow', flow.id, target.name) }
      if (output) { outputs.push(output); insert('output', output.stream, target.name) }
    },
  })
  if (automations.length !== 1) throw new Error(`Expected one @automation interface, received ${automations.length}`)
  return { automation: automations[0], symbols, sources, flows, outputs }
}

export function emitAutomationDocument(graph: JsonRxGraph): Automation {
  const sourceEntries = graph.sources.map((source) => [source.id, {
    kind: 'http.event' as const,
    page: { host: graph.automation.pageHost },
    request: { methods: source.methods, url: source.requestUrl },
  }])
  const circuitSources = graph.sources.map((source) => [source.id, {}])
  const circuitFlows = graph.flows.map((flow) => [flow.id, {
    pipe: [
      { node: `${flow.id}.source`, source: { $ref: flow.source } },
      { node: `${flow.id}.map`, map: { from: flow.from, language: 'jsonata' as const, fields: flow.fields } },
      { node: `${flow.id}.share`, shareReplay: { bufferSize: 1 as const, refCount: true as const } },
    ],
  }])
  return {
    $schema: './node_modules/@hafley66/json-rx/automation.schema.json',
    version: 'automation.v1',
    profile: 'rxjs-7.8',
    id: graph.automation.id,
    enabled: true,
    bindings: { sources: Object.fromEntries(sourceEntries) },
    circuit: { sources: Object.fromEntries(circuitSources), reducers: {}, flows: Object.fromEntries(circuitFlows) },
    outputs: graph.outputs.map((output) => ({
      kind: 'host.emit',
      flow: output.flow,
      stream: output.stream,
      schema: { type: 'object', additionalProperties: true },
    })),
  }
}
