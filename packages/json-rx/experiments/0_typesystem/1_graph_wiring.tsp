import "./1_graph_decorators.js";

using TypeSpec.Reflection;

namespace JsonRxExperiment;

extern dec inputs2(target: Operation, a: Operation, b: Operation);
extern dec input(target: Operation, input: Operation);

model Stream<T> {
  value: T;
}

op Create<T>(): Stream<T>;
op Map<Input, Output>(input: Stream<Input>): Stream<Output>;
op Merge2<A, B>(a: Stream<A>, b: Stream<B>): Stream<A | B>;

model Click { x: int32; }
model Tick { count: int32; }
model View { label: string; }

interface Graph {
  op clicks is Create<Click>;
  op ticks is Create<Tick>;

  @inputs2(Graph.clicks, Graph.ticks)
  op joined is Merge2<Click, Tick>;

  @input(Graph.joined)
  op projected is Map<Click | Tick, View>;
}
