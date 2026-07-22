import * as z from 'zod'

const reference = (kind: 'source' | 'reducer') => z.strictObject({
  $ref: z.string().min(1).meta({ title: `${kind} reference`, 'x-json-rx-ref': kind }),
})
const sourceRef = reference('source')
const reducerRef = reference('reducer')
const parameters = z.strictObject({
  path: z.record(z.string(), z.unknown()).optional(),
  query: z.record(z.string(), z.unknown()).optional(),
})

const sourceBinding = z.union([
  z.strictObject({ kind: z.literal('http.event'), page: z.strictObject({ host: z.string() }), request: z.strictObject({ methods: z.array(z.string()).min(1), url: z.string() }) }),
  z.strictObject({ kind: z.literal('host.event'), operation: z.string().min(1) }),
])

const sourceStep = z.strictObject({ node: z.string().min(1), source: sourceRef }).meta({ title: 'Source' })
const mergeStep = z.strictObject({ node: z.string().min(1), merge: z.strictObject({ sources: z.array(sourceRef).min(1) }) }).meta({ title: 'Merge sources' })
const mapStep = z.strictObject({ node: z.string().min(1), map: z.strictObject({ from: z.string(), language: z.literal('jsonata').default('jsonata'), fields: z.record(z.string(), z.string()).default({}) }) }).meta({ title: 'JSONata map' })
const scanStep = z.strictObject({ node: z.string().min(1), scan: z.strictObject({ reducer: reducerRef }) }).meta({ title: 'Scan reducer' })
const shareStep = z.strictObject({ node: z.string().min(1), shareReplay: z.strictObject({ bufferSize: z.literal(1), refCount: z.literal(true) }) }).meta({ title: 'Share replay' })
export const PipeStepSchema = z.union([sourceStep, mergeStep, mapStep, scanStep, shareStep])
export type PipeStep = z.infer<typeof PipeStepSchema>

const nestedSource = z.strictObject({ node: z.string().min(1), source: sourceRef }).meta({ title: 'Source' })
const NestedExpressionSchema: z.ZodType<NestedExpression> = z.lazy(() => z.union([
  nestedSource,
  z.strictObject({ node: z.string().min(1), map: mapStep.shape.map.extend({ input: NestedExpressionSchema }) }),
  z.strictObject({ node: z.string().min(1), merge: z.strictObject({ inputs: z.array(NestedExpressionSchema).min(1) }) }),
  z.strictObject({ node: z.string().min(1), scan: scanStep.shape.scan.extend({ input: NestedExpressionSchema }) }),
  z.strictObject({ node: z.string().min(1), shareReplay: shareStep.shape.shareReplay.extend({ input: NestedExpressionSchema }) }),
]))
export type NestedExpression =
  | z.infer<typeof nestedSource>
  | { node: string; map: z.infer<typeof mapStep>['map'] & { input: NestedExpression } }
  | { node: string; merge: { inputs: NestedExpression[] } }
  | { node: string; scan: z.infer<typeof scanStep>['scan'] & { input: NestedExpression } }
  | { node: string; shareReplay: z.infer<typeof shareStep>['shareReplay'] & { input: NestedExpression } }

const flow = z.strictObject({
  parameters: parameters.optional(),
  pipe: z.array(PipeStepSchema).min(1).optional(),
  expression: NestedExpressionSchema.optional(),
}).refine((value) => (value.pipe !== undefined) !== (value.expression !== undefined), { message: 'flow requires exactly one of pipe or expression' })

const reducerCase = z.strictObject({ replace: z.string().optional(), patch: z.record(z.string(), z.string()).optional() })
  .refine((value) => (value.replace !== undefined) !== (value.patch !== undefined), { message: 'reducer case requires exactly one operation' })

export const AutomationSchema = z.strictObject({
  $schema: z.string().default('./node_modules/@hafley66/json-rx/automation.schema.json'),
  version: z.literal('automation.v1'),
  profile: z.literal('rxjs-7.8'),
  id: z.string().min(1),
  enabled: z.boolean().default(true),
  bindings: z.strictObject({ sources: z.record(z.string(), sourceBinding) }),
  circuit: z.strictObject({
    sources: z.record(z.string(), z.strictObject({ parameters: parameters.optional() })),
    reducers: z.record(z.string(), z.strictObject({ seed: z.record(z.string(), z.unknown()), cases: z.record(z.string(), reducerCase) })).default({}),
    flows: z.record(z.string(), flow),
  }),
  outputs: z.array(z.strictObject({ kind: z.literal('host.emit'), flow: z.string().meta({ title: 'flow reference', 'x-json-rx-ref': 'flow' }), stream: z.string(), schema: z.record(z.string(), z.unknown()) })).min(1),
}).superRefine((automation, context) => {
  const sources = new Set(Object.keys(automation.circuit.sources))
  const reducers = new Set(Object.keys(automation.circuit.reducers))
  const flows = new Set(Object.keys(automation.circuit.flows))
  const nodes = new Set<string>()
  const node = (id: string) => {
    if (nodes.has(id)) context.addIssue({ code: 'custom', path: ['circuit'], message: `duplicate node id: ${id}` })
    nodes.add(id)
  }
  const source = (value: string) => { if (!sources.has(value)) context.addIssue({ code: 'custom', path: ['circuit'], message: `unknown source: ${value}` }) }
  const reducer = (value: string) => { if (!reducers.has(value)) context.addIssue({ code: 'custom', path: ['circuit'], message: `unknown reducer: ${value}` }) }
  const visit = (value: NestedExpression): void => {
    node(value.node)
    if ('source' in value) source(value.source.$ref)
    if ('merge' in value) value.merge.inputs.forEach(visit)
    if ('map' in value) visit(value.map.input)
    if ('scan' in value) { reducer(value.scan.reducer.$ref); visit(value.scan.input) }
    if ('shareReplay' in value) visit(value.shareReplay.input)
  }
  for (const definition of Object.values(automation.circuit.flows)) {
    if (definition.expression) visit(definition.expression)
    for (const step of definition.pipe ?? []) {
      node(step.node)
      if ('source' in step) source(step.source.$ref)
      if ('merge' in step) step.merge.sources.forEach((entry) => source(entry.$ref))
      if ('scan' in step) reducer(step.scan.reducer.$ref)
    }
    const first = definition.pipe?.[0]
    if (first && !('source' in first) && !('merge' in first)) context.addIssue({ code: 'custom', path: ['circuit', 'flows'], message: 'pipe must start with source or merge' })
  }
  for (const binding of Object.keys(automation.bindings.sources)) source(binding)
  for (const value of sources) if (!(value in automation.bindings.sources)) context.addIssue({ code: 'custom', path: ['bindings', 'sources'], message: `source has no host binding: ${value}` })
  automation.outputs.forEach((output) => { if (!flows.has(output.flow)) context.addIssue({ code: 'custom', path: ['outputs'], message: `unknown flow: ${output.flow}` }) })
})

export type Automation = z.infer<typeof AutomationSchema>
export const AutomationJsonSchema = {
  $id: 'https://unpkg.com/@hafley66/json-rx/automation.schema.json',
  ...z.toJSONSchema(AutomationSchema, { target: 'draft-2020-12', cycles: 'ref', reused: 'ref' }),
}
