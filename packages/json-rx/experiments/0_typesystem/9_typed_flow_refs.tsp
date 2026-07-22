import "./9_typed_flow_refs.js";

namespace JsonRxExperiment;

model Flow<T> {
  value: T;
}

model Reading {
  body: int32;
}

extern fn host(value: unknown): Flow<unknown>;
extern fn field(input: Flow<unknown>, property: unknown): unknown;
extern fn multiply(left: unknown, right: unknown): int32;
extern fn logic(value: unknown): Flow<unknown>;

alias price = Flow<Reading>;
alias quantity = Flow<Reading>;
alias total = logic(multiply(field(price, Reading::body), field(quantity, Reading::body)));
