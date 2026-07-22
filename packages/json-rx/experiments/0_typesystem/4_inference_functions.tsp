import "./4_inference_functions.js";

using TypeSpec.Reflection;

namespace JsonRxExperiment;

extern fn streamValue(target: Operation): unknown;

model Stream<T> {
  value: T;
}

op Create<T>(): Stream<T>;
op Map<Input, Output>(input: Stream<Input>): Stream<Output>;

model Click { x: int32; }
model View { label: string; }

interface Graph {
  op clicks is Create<Click>;
}

alias ClickValue = streamValue(Graph.clicks);
op inferredInput is Map<ClickValue, View>;
