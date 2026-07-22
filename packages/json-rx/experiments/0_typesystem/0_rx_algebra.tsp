namespace JsonRxExperiment;

model Stream<T> {
  value: T;
}

model UnaryOperator<Input, Output> {
  input: Stream<Input>;
  output: Stream<Output>;
}

op map<Input, Output>(input: Stream<Input>, transform: UnaryOperator<Input, Output>): Stream<Output>;

op merge2<A, B>(a: Stream<A>, b: Stream<B>): Stream<A | B>;
op merge3<A, B, C>(a: Stream<A>, b: Stream<B>, c: Stream<C>): Stream<A | B | C>;
op merge4<A, B, C, D>(a: Stream<A>, b: Stream<B>, c: Stream<C>, d: Stream<D>): Stream<A | B | C | D>;
op merge5<A, B, C, D, E>(a: Stream<A>, b: Stream<B>, c: Stream<C>, d: Stream<D>, e: Stream<E>): Stream<A | B | C | D | E>;

model Click { x: int32; }
model Tick { count: int32; }

op clickOrTick is merge2<Click, Tick>;
alias ClickOrTickParameters = clickOrTick::parameters;
alias ClickOrTickOutput = Stream<Click | Tick>;
