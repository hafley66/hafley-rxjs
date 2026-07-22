import type { Program } from '@typespec/compiler'
import { AutomationSchema, type Automation } from '../1_schema'
import { collectJsonRxGraph, emitAutomationDocument } from './2_graph'

export type GeneratedAutomation = { document: Automation; catalog: { sources: string[]; flows: string[] } }

export function generateAutomation(program: Program): GeneratedAutomation {
  const graph = collectJsonRxGraph(program)
  const document = AutomationSchema.parse(emitAutomationDocument(graph))
  return {
    document,
    catalog: {
      sources: [...graph.symbols.values()].filter(({ kind }) => kind === 'source').map(({ address }) => address),
      flows: [...graph.symbols.values()].filter(({ kind }) => kind === 'flow').map(({ address }) => address),
    },
  }
}
