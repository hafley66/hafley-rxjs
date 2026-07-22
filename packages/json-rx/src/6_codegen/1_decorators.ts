import { setTypeSpecNamespace, type DecoratorContext, type Interface, type Model, type Numeric, type Operation } from '@typespec/compiler'
import { createStateSymbol } from '../4_typespec/0_library'

export type AlgorithmMetadata = { name: string }
export type SnapshotPatchMetadata = {
  events: Operation
  cases: Record<string, 'replace' | 'patch'>
  valueField: string
}
export type MapMetadata = { input: Operation; operator: '*'; right: Numeric }
export type FilterMetadata = { input: Operation; operator: '>='; right: Numeric }
export type ScanMetadata = { input: Operation; reducer: 'sum'; seed: Numeric }
export type SwitchMapMetadata = { input: Operation; delayField: string; outputField: string }
export type ReactiveStateMetadata = { next: Model; failure: Model }

export const algorithmKey = createStateSymbol('codegen.algorithms')
export const snapshotPatchKey = createStateSymbol('codegen.snapshotPatch')
export const mergeByKeyKey = createStateSymbol('codegen.mergeByKey')
export const mapKey = createStateSymbol('codegen.map')
export const filterKey = createStateSymbol('codegen.filter')
export const scanKey = createStateSymbol('codegen.scan')
export const switchMapKey = createStateSymbol('codegen.switchMap')
export const reactiveStateKey = createStateSymbol('codegen.reactiveState')

export function $algorithm(context: DecoratorContext, target: Interface, name: string) {
  context.program.stateMap(algorithmKey).set(target, { name } satisfies AlgorithmMetadata)
}

export function $snapshotPatch(
  context: DecoratorContext,
  target: Operation,
  events: Operation,
  cases: Record<string, 'replace' | 'patch'>,
  valueField: string,
) {
  context.program.stateMap(snapshotPatchKey).set(target, {
    events,
    cases,
    valueField,
  } satisfies SnapshotPatchMetadata)
}

export function $mergeByKey(context: DecoratorContext, target: Operation, inputs: Model) {
  context.program.stateMap(mergeByKeyKey).set(target, inputs)
}

export function $map(context: DecoratorContext, target: Operation, input: Operation, operator: '*', right: Numeric) {
  context.program.stateMap(mapKey).set(target, { input, operator, right } satisfies MapMetadata)
}

export function $filter(context: DecoratorContext, target: Operation, input: Operation, operator: '>=', right: Numeric) {
  context.program.stateMap(filterKey).set(target, { input, operator, right } satisfies FilterMetadata)
}

export function $scan(context: DecoratorContext, target: Operation, input: Operation, reducer: 'sum', seed: Numeric) {
  context.program.stateMap(scanKey).set(target, { input, reducer, seed } satisfies ScanMetadata)
}

export function $switchMap(context: DecoratorContext, target: Operation, input: Operation, delayField: string, outputField: string) {
  context.program.stateMap(switchMapKey).set(target, { input, delayField, outputField } satisfies SwitchMapMetadata)
}
export function $reactiveState(context: DecoratorContext, target: Operation, next: Model, failure: Model) {
  context.program.stateMap(reactiveStateKey).set(target, { next, failure } satisfies ReactiveStateMetadata)
}

setTypeSpecNamespace('JsonRx.Codegen', $algorithm, $mergeByKey, $snapshotPatch, $map, $filter, $scan, $switchMap, $reactiveState)
