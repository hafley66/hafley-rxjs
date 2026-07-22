import { $ } from "@typespec/compiler/typekit";

const graphStateKey = Symbol.for("@hafley66/json-rx/observable-constructor-graphs");
const graphState = globalThis[graphStateKey] ??= { graphs: new WeakMap() };
export const graphs = graphState.graphs;
const constructors = new WeakMap();

function flow(context, value, kind, inputs = [], config = {}) {
  const kit = $(context.program);
  const result = kit.model.create({
    properties: {
      value: kit.modelProperty.create({ name: "value", type: value }),
    },
  });
  const nodes = graphs.get(context.program) ?? [];
  nodes.push({ kind, value, inputs, config });
  graphs.set(context.program, nodes);
  return result;
}

function valueOf(flowType) {
  return flowType.properties.get("value")?.type ?? flowType;
}

function host(context, value, address) {
  return flow(context, value, "host", [], { address });
}

function signal(context, input, output, logic) {
  const kit = $(context.program);
  const constructor = kit.model.create({
    properties: {
      input: kit.modelProperty.create({ name: "input", type: input }),
      output: kit.modelProperty.create({ name: "output", type: output }),
    },
  });
  constructors.set(constructor, { input, output, logic });
  return constructor;
}

function close(context, constructor, input) {
  if (!constructor || !input) throw new Error(`close arguments: ${JSON.stringify({ constructor: Boolean(constructor), input: Boolean(input) })}`);
  const definition = constructors.get(constructor);
  if (!definition) return flow(context, valueOf(input), "signal", [input], { invalidConstructor: true });
  const [, diagnostics] = $(context.program).type.isAssignableTo.withDiagnostics(
    valueOf(input),
    definition.input,
    context.functionCallTarget,
  );
  context.program.reportDiagnostics(diagnostics);
  return flow(context, definition.output, "signal", [input], { logic: definition.logic });
}

function emit(context, input, stream) {
  return flow(context, valueOf(input), "emit", [input], { stream });
}

export const $functions = {
  JsonRxExperiment: { host, signal, close, emit },
};
