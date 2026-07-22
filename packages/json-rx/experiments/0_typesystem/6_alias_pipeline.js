import { getHttpOperation } from '@typespec/http'
import { $ } from '@typespec/compiler/typekit'

export const graphs = new WeakMap()

function node(context, kind, value, inputs = [], config = {}) {
  const kit = $(context.program)
  const result = kit.model.create({
    properties: {
      value: kit.modelProperty.create({ name: 'value', type: value }),
    },
  })
  const nodes = graphs.get(context.program) ?? []
  nodes.push({ kind, type: result, value, inputs, config })
  graphs.set(context.program, nodes)
  return result
}

function valueOf(type) {
  return type.kind === 'Model' ? type.properties.get('value')?.type ?? type : type
}

function http(context, operation) {
  const [httpOperation, diagnostics] = getHttpOperation(context.program, operation)
  context.program.reportDiagnostics(diagnostics)
  const response = httpOperation.responses.find(({ statusCodes }) => statusCodes === 200)
  const body = response?.responses.find((content) => content.body)?.body
  if (!body) return node(context, 'http', operation.returnType, [], { operation })
  return node(context, 'http', body.type, [], { operation })
}

function map(context, input, output, fields) {
  return node(context, 'map', output, [input], { fields, input: valueOf(input) })
}

function shareReplay(context, input, bufferSize) {
  return node(context, 'shareReplay', valueOf(input), [input], { bufferSize })
}

function emit(context, input, stream) {
  return node(context, 'emit', valueOf(input), [input], { stream })
}

function expectValue(context, input, expected) {
  const [, diagnostics] = $(context.program).type.isAssignableTo.withDiagnostics(valueOf(input), expected, context.functionCallTarget)
  context.program.reportDiagnostics(diagnostics)
  return input
}

export const $functions = {
  JsonRxExperiment: { http, map, shareReplay, emit, expectValue },
}
