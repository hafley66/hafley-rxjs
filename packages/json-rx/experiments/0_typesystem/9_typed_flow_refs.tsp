import "./9_typed_flow_refs.js";

namespace JsonRxExperiment;

model Flow<T> {}

extern fn multiply(left: unknown, right: unknown): int32;
extern fn logic(value: unknown): Flow<unknown>;

namespace price {
  alias body = int32;
}

namespace quantity {
  alias body = int32;
}

alias total = logic(multiply(price.body, quantity.body));
