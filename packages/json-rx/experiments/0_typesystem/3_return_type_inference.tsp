namespace JsonRxExperiment;

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

alias ClickStream = Graph.clicks::returnType;
alias ClickValue = Graph.clicks::returnType.value.type;

op inferredInput is Map<ClickValue, View>;
