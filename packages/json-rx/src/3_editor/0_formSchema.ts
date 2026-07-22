import type { RJSFSchema } from '@rjsf/utils'
import { AutomationJsonSchema } from '../1_schema'

type ReferenceKind = 'source' | 'reducer' | 'flow'

function referenceChoices(value: unknown): Record<ReferenceKind, string[]> {
  const document = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const circuit = document.circuit && typeof document.circuit === 'object' ? document.circuit as Record<string, unknown> : {}
  const keys = (candidate: unknown) => candidate && typeof candidate === 'object' ? Object.keys(candidate) : []
  return {
    source: keys(circuit.sources),
    reducer: keys(circuit.reducers),
    flow: keys(circuit.flows),
  }
}

export function automationFormSchema(value: unknown): RJSFSchema {
  const { $id: _schemaId, $schema: _metaSchema, ...schema } = structuredClone(AutomationJsonSchema)
  const choices = referenceChoices(value)
  const visit = (candidate: unknown): void => {
    if (!candidate || typeof candidate !== 'object') return
    const node = candidate as Record<string, unknown>
    const kind = node['x-json-rx-ref']
    if ((kind === 'source' || kind === 'reducer' || kind === 'flow') && choices[kind].length) node.enum = choices[kind]
    Object.values(node).forEach(visit)
  }
  visit(schema)
  return schema as RJSFSchema
}
