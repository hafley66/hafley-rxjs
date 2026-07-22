import "./1_graph_decorators.js";

using TypeSpec.Reflection;

namespace JsonRxExperiment;

extern dec input(target: Operation, input: Operation);

model Stream<T> {
  value: T;
}

op Create<T>(): Stream<T>;
op Map<Input, Output>(input: Stream<Input>): Stream<Output>;

model Click { x: int32; }
model Tick { count: int32; }
model View { label: string; }

interface InvalidGraph {
  op ticks is Create<Tick>;

  @input(InvalidGraph.ticks)
  op projected is Map<Click, View>;
}
