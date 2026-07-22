export type TypeReference = { name: string }

export type SourceIr = {
  type: TypeReference
  eventVariant: string
}

export type MergeByKeyIr = {
  kind: 'mergeByKey'
  event: TypeReference
  valueField: string
}

export type ExpressionIr =
  | { kind: 'parameter'; name: 'value' }
  | { kind: 'literal'; value: number }
  | { kind: 'binary'; operator: '*' | '>=' | '+'; left: ExpressionIr; right: ExpressionIr }

export type MapIr = {
  kind: 'map'
  expression: ExpressionIr
}

export type FilterIr = {
  kind: 'filter'
  predicate: ExpressionIr
}

export type SwitchMapIr = {
  kind: 'switchMap'
  delayField: string
  outputField: string
}

export type ScanIr =
  | {
      kind: 'scan'
      reducer: {
        kind: 'snapshotPatch'
        cases: Array<{ variant: string; mode: 'replace' | 'patch' }>
      }
    }
  | {
      kind: 'scan'
      reducer: { kind: 'sum'; seed: ExpressionIr }
    }

export type PipelineIr = {
  name: string
  input: {
    kind: 'record'
    entries: Record<string, SourceIr>
  }
  pipe: [MergeByKeyIr, ...(MapIr | FilterIr | ScanIr | SwitchMapIr)[]]
  output: TypeReference
}

export type ReactiveStateIr = { name: string; next: TypeReference; failure: TypeReference }
