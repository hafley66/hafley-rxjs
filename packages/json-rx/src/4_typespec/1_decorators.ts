import { setTypeSpecNamespace, type DecoratorContext, type Interface, type Operation } from '@typespec/compiler'
import { createStateSymbol } from './0_library'

export type AutomationMetadata = { id: string; pageHost: string }
export type SourceMetadata = { id: string; requestUrl: string; methods: string[] }
export type MapFlowMetadata = { kind: 'map'; id: string; source: string; from: string; fields: Record<string, string> }
export type LogicFlowMetadata = {
  kind: 'logic'
  id: string
  expression: unknown
  references: Array<{ name: string; kind: 'source' | 'flow'; ref: string }>
}
export type FlowMetadata = MapFlowMetadata | LogicFlowMetadata
export type OutputMetadata = { flow: string; stream: string }

export const automationKey = createStateSymbol('automations')
export const sourceKey = createStateSymbol('sources')
export const flowKey = createStateSymbol('flows')
export const outputKey = createStateSymbol('outputs')

export function $automation(context: DecoratorContext, target: Interface, id: string, pageHost: string) {
  context.program.stateMap(automationKey).set(target, { id, pageHost } satisfies AutomationMetadata)
}

export function $source(context: DecoratorContext, target: Operation, id: string, requestUrl: string, methods: string[]) {
  context.program.stateMap(sourceKey).set(target, { id, requestUrl, methods } satisfies SourceMetadata)
}

export function $flow(context: DecoratorContext, target: Operation, id: string, source: string, from: string, fields: Record<string, string>) {
  context.program.stateMap(flowKey).set(target, { kind: 'map', id, source, from, fields } satisfies MapFlowMetadata)
}

export function $output(context: DecoratorContext, target: Operation, flow: string, stream: string) {
  context.program.stateMap(outputKey).set(target, { flow, stream } satisfies OutputMetadata)
}

setTypeSpecNamespace('JsonRx', $automation, $source, $flow, $output)
