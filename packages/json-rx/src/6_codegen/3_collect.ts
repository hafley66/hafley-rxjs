import type { Interface, Model, Operation, Program, Type, Union } from '@typespec/compiler'
import type { ExpressionIr, PipelineIr, ReactiveStateIr, TypeReference } from './0_pipelineIr'
import {
  algorithmKey,
  filterKey,
  mapKey,
  mergeByKeyKey,
  reactiveStateKey,
  scanKey,
  snapshotPatchKey,
  switchMapKey,
  type AlgorithmMetadata,
  type FilterMetadata,
  type MapMetadata,
  type ReactiveStateMetadata,
  type ScanMetadata,
  type SnapshotPatchMetadata,
  type SwitchMapMetadata,
} from './1_decorators'

function namedType(type: Type, role: string): TypeReference {
  const name = 'name' in type && typeof type.name === 'string' ? type.name : undefined
  if (!name) throw new Error(`${role} operation must return a named TypeSpec type`)
  return { name }
}

function typeName(operation: Operation, role: string) {
  return namedType(operation.returnType, role)
}

function literalValue(value: unknown): unknown {
  let current = value
  while (typeof current === 'object' && current !== null && 'value' in current) current = (current as { value: unknown }).value
  return current
}

function numericExpression(value: unknown): ExpressionIr {
  return { kind: 'literal', value: Number(literalValue(value)) }
}

function collectInputs(program: Program, algorithm: AlgorithmMetadata, events: Operation, valueField: string) {
  const inputs = program.stateMap(mergeByKeyKey).get(events) as Model | undefined
  if (!inputs) throw new Error(`Algorithm ${algorithm.name} event operation requires @mergeByKey`)
  const eventUnion = events.returnType as Union
  if (eventUnion.kind !== 'Union') throw new Error(`Algorithm ${algorithm.name} events must return a named union`)
  const variants = [...eventUnion.variants.values()]
  return {
    input: {
      kind: 'record' as const,
      entries: Object.fromEntries([...inputs.properties.values()].map((property) => {
        const variant = variants.find((candidate) => candidate.name === property.name)
        if (!variant) throw new Error(`Event union requires a named '${property.name}' variant`)
        return [property.name, {
          type: namedType(property.type, `Input '${property.name}'`),
          eventVariant: String(variant.name),
        }]
      })),
    },
    mergeByKey: { kind: 'mergeByKey' as const, event: typeName(events, 'Event'), valueField },
  }
}

export function collectPipelines(program: Program): PipelineIr[] {
  const snapshotPipelines = [...program.stateMap(algorithmKey).entries()].flatMap<PipelineIr>(([target, value]) => {
    const owner = target as Interface
    const algorithm = value as AlgorithmMetadata
    const states = [...owner.operations.values()].filter((operation) => program.stateMap(snapshotPatchKey).has(operation))
    if (states.length === 0) return []
    if (states.length !== 1) throw new Error(`Algorithm ${algorithm.name} must contain one @snapshotPatch operation`)
    const state = states[0]
    const metadata = program.stateMap(snapshotPatchKey).get(state) as SnapshotPatchMetadata
    const { input, mergeByKey } = collectInputs(program, algorithm, metadata.events, metadata.valueField)
    return [{
      name: algorithm.name,
      input,
      pipe: [
        mergeByKey,
        { kind: 'scan', reducer: { kind: 'snapshotPatch', cases: Object.entries(metadata.cases).map(([variant, mode]) => ({ variant, mode })) } },
      ],
      output: typeName(state, 'State'),
    } satisfies PipelineIr]
  })
  const sumPipelines = [...program.stateMap(algorithmKey).entries()].flatMap<PipelineIr>(([target, value]) => {
    const owner = target as Interface
    const algorithm = value as AlgorithmMetadata
    const states = [...owner.operations.values()].filter((operation) => program.stateMap(scanKey).has(operation))
    if (states.length === 0) return []
    if (states.length !== 1) throw new Error(`Algorithm ${algorithm.name} must contain one @scan operation`)
    const state = states[0]
    const scan = program.stateMap(scanKey).get(state) as ScanMetadata
    const filter = program.stateMap(filterKey).get(scan.input) as FilterMetadata | undefined
    if (!filter) throw new Error(`Algorithm ${algorithm.name} @scan input requires @filter`)
    const map = program.stateMap(mapKey).get(filter.input) as MapMetadata | undefined
    if (!map) throw new Error(`Algorithm ${algorithm.name} @filter input requires @map`)
    const { input, mergeByKey } = collectInputs(program, algorithm, map.input, 'value')
    return [{
      name: algorithm.name,
      input,
      pipe: [
        mergeByKey,
        { kind: 'map', expression: { kind: 'binary', operator: literalValue(map.operator) as '*', left: { kind: 'parameter', name: 'value' }, right: numericExpression(map.right) } },
        { kind: 'filter', predicate: { kind: 'binary', operator: literalValue(filter.operator) as '>=', left: { kind: 'parameter', name: 'value' }, right: numericExpression(filter.right) } },
        { kind: 'scan', reducer: { kind: 'sum', seed: numericExpression(scan.seed) } },
      ],
      output: typeName(state, 'State'),
    } satisfies PipelineIr]
  })
  const switchMapPipelines = [...program.stateMap(algorithmKey).entries()].flatMap<PipelineIr>(([target, value]) => {
    const owner = target as Interface
    const algorithm = value as AlgorithmMetadata
    const states = [...owner.operations.values()].filter((operation) => program.stateMap(switchMapKey).has(operation))
    if (states.length === 0) return []
    if (states.length !== 1) throw new Error(`Algorithm ${algorithm.name} must contain one @switchMap operation`)
    const state = states[0]
    const switchMap = program.stateMap(switchMapKey).get(state) as SwitchMapMetadata
    const { input, mergeByKey } = collectInputs(program, algorithm, switchMap.input, 'value')
    return [{
      name: algorithm.name,
      input,
      pipe: [
        mergeByKey,
        { kind: 'switchMap', delayField: literalValue(switchMap.delayField) as string, outputField: literalValue(switchMap.outputField) as string },
      ],
      output: typeName(state, 'State'),
    } satisfies PipelineIr]
  })
  return [...snapshotPipelines, ...sumPipelines, ...switchMapPipelines]
}

export function collectReactiveStates(program: Program): ReactiveStateIr[] {
  return [...program.stateMap(algorithmKey).entries()].flatMap(([target, value]) => {
    const owner = target as Interface
    const algorithm = value as AlgorithmMetadata
    const states = [...owner.operations.values()].filter((operation) => program.stateMap(reactiveStateKey).has(operation))
    if (states.length === 0) return []
    if (states.length !== 1) throw new Error(`Algorithm ${algorithm.name} must contain one @reactiveState operation`)
    const state = states[0]
    const metadata = program.stateMap(reactiveStateKey).get(state) as ReactiveStateMetadata
    return [{ name: typeName(state, 'State').name, next: namedType(metadata.next, 'Next'), failure: namedType(metadata.failure, 'Failure') }]
  })
}
