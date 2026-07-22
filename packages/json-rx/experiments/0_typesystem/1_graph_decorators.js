import { setTypeSpecNamespace } from '@typespec/compiler'
import { $ } from '@typespec/compiler/typekit'

export const graphEdges = new WeakMap()

function validate(context, target, inputs) {
  graphEdges.set(target, inputs)
  return {
    onGraphFinish() {
      const parameters = [...target.parameters.properties.values()]
      return inputs.flatMap((input, index) => {
        const expected = parameters[index]
        if (!expected) return []
        const [, diagnostics] = $(context.program).type.isAssignableTo.withDiagnostics(input.returnType, expected.type, input)
        return diagnostics
      })
    },
  }
}

export function $inputs2(context, target, a, b) {
  graphEdges.set(target, [a, b])
  return validate(context, target, [a, b])
}

export function $input(context, target, input) {
  return validate(context, target, [input])
}

setTypeSpecNamespace('JsonRxExperiment', $inputs2, $input)
