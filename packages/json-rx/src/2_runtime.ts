import jsonata from 'jsonata'
import jsonLogic from 'json-logic-js'
import { combineLatest, concatMap, defer, from, map, merge, type Observable, scan, shareReplay } from 'rxjs'
import type { RulesLogic } from 'json-logic-js'
import type { JsonObject, JsonValue, RuntimeEmission, RuntimeSource } from './0_types'
import { AutomationSchema, type Automation, type NestedExpression, type PipeStep } from './1_schema'

type LocatedValue = { value: JsonValue; origin?: { url: string; ts: number } }
export type AutomationRuntime = { automation: Automation; roots: Record<string, Observable<RuntimeEmission>>; canonicalIr: string }
export type AutomationTrace = { node: string; phase: 'map'; path: string; language: 'jsonata'; expression: string; outcome: 'passed' | 'missing' | 'error'; result?: unknown; reason?: string }

function origin(value: RuntimeSource): LocatedValue['origin'] {
  return { url: 'pageUrl' in value ? value.pageUrl : value.url, ts: value.ts }
}
function get(value: JsonValue, pointer: string): JsonValue {
  let current = value
  for (const segment of pointer.slice(2).split('.')) {
    if (typeof current !== 'object' || current === null || Array.isArray(current)) throw new Error(`Path did not resolve: ${pointer}`)
    current = current[segment]
  }
  if (current === undefined) throw new Error(`Path did not resolve: ${pointer}`)
  return current
}
function getOptional(value: JsonValue, pointer: string): JsonValue | undefined {
  try { return get(value, pointer) } catch { return undefined }
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonical(entry)]))
}

export function compileAutomation(input: unknown, sources: Record<string, Observable<RuntimeSource>>, options: { trace?: (entry: AutomationTrace) => void } = {}): AutomationRuntime {
  const automation = AutomationSchema.parse(input)
  const source = (ref: string) => defer(() => {
    const value = sources[ref]
    if (!value) throw new Error(`Missing source runtime binding: ${ref}`)
    return value.pipe(map((entry) => ({ value: entry as unknown as JsonValue, origin: origin(entry) })))
  })
  let flow: (ref: string) => Observable<LocatedValue>
  const logic = (definition: { expression: unknown; inputs: Record<string, { kind: 'source' | 'flow'; $ref: string }> }): Observable<LocatedValue> => {
    const inputs = Object.fromEntries(Object.entries(definition.inputs).map(([name, input]) => [
      name,
      input.kind === 'source' ? source(input.$ref) : flow(input.$ref),
    ])) as Record<string, Observable<LocatedValue>>
    return combineLatest(inputs).pipe(map((values) => ({
      value: jsonLogic.apply(definition.expression as RulesLogic, Object.fromEntries(Object.entries(values).map(([name, entry]) => [name, entry.value]))) as JsonValue,
      origin: Object.values(values).find((entry) => entry.origin)?.origin,
    })))
  }
  const apply = (input$: Observable<LocatedValue>, step: PipeStep): Observable<LocatedValue> => {
    if ('map' in step) return input$.pipe(concatMap((inputValue) => {
      const root = get(inputValue.value, step.map.from)
      return from(Promise.all(Object.entries(step.map.fields).map(async ([field, expression]) => {
        try {
          const value = await jsonata(expression).evaluate(root)
          options.trace?.({ node: step.node, phase: 'map', path: field, language: 'jsonata', expression, outcome: value === undefined ? 'missing' : 'passed', result: value })
          return value === undefined ? [] as const : [field, value] as const
        } catch (error) {
          options.trace?.({ node: step.node, phase: 'map', path: field, language: 'jsonata', expression, outcome: 'error', reason: String(error) })
          return [] as const
        }
      }))).pipe(map((entries) => ({ value: Object.fromEntries(entries.filter((entry) => entry.length === 2)) as JsonValue, origin: inputValue.origin })))
    }))
    if ('scan' in step) {
      const reducer = automation.circuit.reducers[step.scan.reducer.$ref]
      return input$.pipe(scan<LocatedValue, LocatedValue>((previous, inputValue) => {
        const event = inputValue.value as JsonObject
        const branch = typeof event.type === 'string' ? reducer.cases[event.type] : undefined
        if (!branch) return { value: previous.value, origin: inputValue.origin }
        const next = branch.replace ? get(inputValue.value, branch.replace) : { ...(previous.value as JsonObject), ...Object.fromEntries(Object.entries(branch.patch ?? {}).flatMap(([field, path]) => {
          const value = getOptional(inputValue.value, path)
          return value === undefined ? [] : [[field, value]]
        })) }
        return { value: next, origin: inputValue.origin }
      }, { value: reducer.seed as JsonValue }))
    }
    if ('shareReplay' in step) return input$.pipe(shareReplay({ bufferSize: 1, refCount: true }))
    if ('logic' in step) return logic(step.logic)
    throw new Error(`Source operator must be first: ${step.node}`)
  }
  const nested = (expression: NestedExpression): Observable<LocatedValue> => {
    if ('source' in expression) return source(expression.source.$ref)
    if ('merge' in expression) return merge(...expression.merge.inputs.map(nested))
    if ('logic' in expression) return logic(expression.logic)
    const { input, ...operator } = 'map' in expression ? expression.map : 'scan' in expression ? expression.scan : expression.shareReplay
    return apply(nested(input), { node: expression.node, ...('map' in expression ? { map: operator } : 'scan' in expression ? { scan: operator } : { shareReplay: operator }) } as PipeStep)
  }
  const piped = (steps: PipeStep[]) => {
    const [first, ...rest] = steps
    const start = 'source' in first ? source(first.source.$ref) : 'merge' in first ? merge(...first.merge.sources.map((entry) => source(entry.$ref))) : 'logic' in first ? logic(first.logic) : (() => { throw new Error('Pipe must start with source, merge, or logic') })()
    return rest.reduce(apply, start)
  }
  const compiledFlows = new Map<string, Observable<LocatedValue>>()
  flow = (ref) => {
    const cached = compiledFlows.get(ref)
    if (cached) return cached
    const definition = automation.circuit.flows[ref]
    if (!definition) throw new Error(`Missing flow runtime binding: ${ref}`)
    const value = definition.pipe ? piped(definition.pipe) : nested(definition.expression!)
    compiledFlows.set(ref, value)
    return value
  }
  const roots = Object.fromEntries(automation.outputs.map((output) => {
    const values = flow(output.flow)
    return [output.stream, values.pipe(map((entry): RuntimeEmission => ({ automationId: automation.id, output: output.flow, stream: output.stream, value: entry.value, schema: output.schema, ...(entry.origin ? { origin: entry.origin } : {}) })))]
  }))
  return { automation, roots, canonicalIr: JSON.stringify(canonical(automation)) }
}
